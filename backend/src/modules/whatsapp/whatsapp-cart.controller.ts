import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartService } from './services/cart.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ProductsService } from '../products/products.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  RemoveFromCartDto,
  ClearCartDto,
  CartResponseDto,
  CartSummaryResponseDto,
} from './dto/cart.dto';

/**
 * WhatsApp Cart Controller
 *
 * Security considerations:
 * - GET endpoints are public but rate-limited (for WhatsApp integration)
 * - POST/DELETE endpoints require authentication (JWT)
 * - Tenant validation is enforced on all operations
 * - Input sanitization and validation on all endpoints
 * - Rate limiting applied at controller level
 */
@ApiTags('WhatsApp - Carrinho')
@Controller('whatsapp/cart')
export class WhatsAppCartController {
  // Simple in-memory rate limiting for public endpoints
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX = 30; // 30 requests per minute

  constructor(
    private readonly cartService: CartService,
    private readonly tenantsService: TenantsService,
    private readonly productsService: ProductsService,
  ) {}

  // ============================================
  // Public endpoints (rate-limited)
  // ============================================

  @Public()
  @Get(':tenantId/:customerPhone')
  @ApiOperation({ summary: 'Obter carrinho do cliente (público, rate-limited)' })
  @ApiResponse({ status: 200, description: 'Carrinho encontrado' })
  @ApiResponse({ status: 404, description: 'Carrinho não encontrado' })
  @ApiResponse({ status: 429, description: 'Muitas requisições' })
  async getCart(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
  ): Promise<CartResponseDto> {
    // Rate limiting check
    this.checkRateLimit(tenantId);

    // Sanitize inputs
    const sanitizedTenantId = this.sanitizeString(tenantId);
    const sanitizedPhone = this.sanitizePhone(customerPhone);

    // Validate inputs
    await this.validateTenant(sanitizedTenantId);
    this.validatePhoneFormat(sanitizedPhone);

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);

    return this.formatCartResponse(cart);
  }

  @Public()
  @Get(':tenantId/:customerPhone/summary')
  @ApiOperation({ summary: 'Obter resumo do carrinho para WhatsApp (público, rate-limited)' })
  @ApiResponse({ status: 200, description: 'Resumo do carrinho' })
  @ApiResponse({ status: 429, description: 'Muitas requisições' })
  async getCartSummary(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
  ): Promise<CartSummaryResponseDto> {
    // Rate limiting check
    this.checkRateLimit(tenantId);

    // Sanitize inputs
    const sanitizedTenantId = this.sanitizeString(tenantId);
    const sanitizedPhone = this.sanitizePhone(customerPhone);

    await this.validateTenant(sanitizedTenantId);
    this.validatePhoneFormat(sanitizedPhone);

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    const formattedSummary = this.cartService.generateSummary(cart);

    return {
      hasCart: cart.items.length > 0,
      itemCount: cart.items.length,
      totalValue: Number(cart.total_amount),
      expired: cart.status === 'expired',
      formattedSummary,
    };
  }

  // ============================================
  // Protected endpoints (require JWT)
  // ============================================

  @UseGuards(JwtAuthGuard)
  @Post('add')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adicionar item ao carrinho (autenticado)' })
  @ApiResponse({ status: 201, description: 'Item adicionado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async addToCart(@Body() dto: AddToCartDto): Promise<CartResponseDto> {
    // Validate DTO
    this.validateDto(dto);

    // Sanitize inputs
    const sanitizedTenantId = this.sanitizeString(dto.tenantId);
    const sanitizedPhone = this.sanitizePhone(dto.customerPhone);
    const sanitizedProductId = this.sanitizeString(dto.productId);

    await this.validateTenant(sanitizedTenantId);
    this.validatePhoneFormat(sanitizedPhone);

    // Validate product belongs to tenant
    await this.validateProductBelongsToTenant(sanitizedTenantId, sanitizedProductId);

    // Validate quantity
    if (dto.quantity < 1 || dto.quantity > 100) {
      throw new BadRequestException('Quantidade deve ser entre 1 e 100');
    }

    const result = await this.cartService.addItem({
      tenantId: sanitizedTenantId,
      customerPhone: sanitizedPhone,
      produtoId: sanitizedProductId,
      produtoName: dto.productName || sanitizedProductId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice || 0,
    });

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);

    return this.formatCartResponse(cart);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar quantidade de item no carrinho (autenticado)' })
  @ApiResponse({ status: 200, description: 'Item atualizado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async updateItem(@Body() dto: UpdateCartItemDto): Promise<CartResponseDto> {
    this.validateDto(dto);

    const sanitizedTenantId = this.sanitizeString(dto.tenantId);
    const sanitizedPhone = this.sanitizePhone(dto.customerPhone);
    const sanitizedProductId = this.sanitizeString(dto.productId);

    await this.validateTenant(sanitizedTenantId);
    this.validatePhoneFormat(sanitizedPhone);

    // Validate quantity
    if (dto.quantity < 0 || dto.quantity > 100) {
      throw new BadRequestException('Quantidade deve ser entre 0 e 100');
    }

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    const updatedCart = await this.cartService.updateItem(cart.id, sanitizedProductId, dto.quantity);

    return this.formatCartResponse(updatedCart);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('remove')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover item do carrinho (autenticado)' })
  @ApiResponse({ status: 200, description: 'Item removido' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async removeItem(@Body() dto: RemoveFromCartDto): Promise<CartResponseDto> {
    this.validateDto(dto);

    const sanitizedTenantId = this.sanitizeString(dto.tenantId);
    const sanitizedPhone = this.sanitizePhone(dto.customerPhone);
    const sanitizedProductId = this.sanitizeString(dto.productId);

    await this.validateTenant(sanitizedTenantId);
    this.validatePhoneFormat(sanitizedPhone);

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    const updatedCart = await this.cartService.removeItem(cart.id, sanitizedProductId);

    return this.formatCartResponse(updatedCart);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Limpar carrinho (autenticado)' })
  @ApiResponse({ status: 200, description: 'Carrinho limpo' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async clearCart(@Body() dto: ClearCartDto): Promise<CartResponseDto> {
    this.validateDto(dto);

    const sanitizedTenantId = this.sanitizeString(dto.tenantId);
    const sanitizedPhone = this.sanitizePhone(dto.customerPhone);

    await this.validateTenant(sanitizedTenantId);
    this.validatePhoneFormat(sanitizedPhone);

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    const clearedCart = await this.cartService.clearCart(cart.id);

    return this.formatCartResponse(clearedCart);
  }

  // ============================================
  // Private helper methods
  // ============================================

  /**
   * Simple rate limiting using in-memory store
   * In production, use Redis for distributed rate limiting
   */
  private checkRateLimit(tenantId: string): void {
    const now = Date.now();
    const key = `public:${tenantId}`;

    const record = this.requestCounts.get(key);

    if (!record || now > record.resetTime) {
      // New window
      this.requestCounts.set(key, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
    } else {
      // Existing window
      record.count++;
      if (record.count > this.RATE_LIMIT_MAX) {
        throw new ForbiddenException('Muitas requisições. Tente novamente em alguns minutos.');
      }
    }
  }

  /**
   * Sanitize string input - remove potentially dangerous characters
   */
  private sanitizeString(input: string): string {
    if (!input) return '';

    // Remove control characters and trim
    return input
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[<>'"]/g, '') // Remove HTML-like characters
      .trim()
      .substring(0, 255); // Limit length
  }

  /**
   * Sanitize phone number - keep only digits and basic formatting
   */
  private sanitizePhone(phone: string): string {
    if (!phone) return '';

    // Keep only digits, spaces, hyphens, and plus sign
    return phone
      .replace(/[^\d\s\-+]/g, '')
      .trim()
      .substring(0, 20); // Limit length
  }

  /**
   * Validate tenant exists and is active
   */
  private async validateTenant(tenantId: string): Promise<void> {
    if (!tenantId || tenantId === 'undefined' || tenantId === 'null' || tenantId === '') {
      throw new ForbiddenException('Tenant ID é obrigatório');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new ForbiddenException('Tenant ID deve ser um UUID válido');
    }

    // Verify tenant exists and is active
    try {
      const tenant = await this.tenantsService.findOneById(tenantId);
      if (!tenant) {
        throw new ForbiddenException('Tenant não encontrado');
      }
    } catch {
      throw new ForbiddenException('Erro ao validar tenant');
    }
  }

  /**
   * Validate phone format (Brazilian numbers)
   */
  private validatePhoneFormat(phone: string): void {
    if (!phone || phone.length < 8) {
      throw new ForbiddenException('Número de telefone inválido');
    }

    // Remove non-digits for validation
    const digitsOnly = phone.replace(/\D/g, '');

    // Brazilian phone validation (10-13 digits with country code)
    if (digitsOnly.length < 10 || digitsOnly.length > 13) {
      throw new ForbiddenException('Número de telefone deve ter 10-13 dígitos');
    }
  }

  /**
   * Validate product belongs to tenant
   */
  private async validateProductBelongsToTenant(tenantId: string, productId: string): Promise<void> {
    if (!productId) {
      throw new BadRequestException('Product ID é obrigatório');
    }

    // Sanitize product ID
    const sanitizedProductId = this.sanitizeString(productId);

    if (!sanitizedProductId) {
      throw new BadRequestException('Product ID inválido');
    }

    try {
      // Verify product exists and belongs to tenant
      const product = await this.productsService.findOne(sanitizedProductId);

      if (!product) {
        throw new BadRequestException('Produto não encontrado');
      }

      if (product.tenant_id !== tenantId) {
        throw new ForbiddenException('Produto não pertence a este tenant');
      }
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Erro ao validar produto');
    }
  }

  /**
   * Validate DTO has required fields
   */
  private validateDto(dto: any): void {
    if (!dto) {
      throw new BadRequestException('Dados não fornecidos');
    }

    if (!dto.tenantId) {
      throw new BadRequestException('Tenant ID é obrigatório');
    }

    if (!dto.customerPhone) {
      throw new BadRequestException('Telefone do cliente é obrigatório');
    }

    if (dto.productId !== undefined && !dto.productId) {
      throw new BadRequestException('Product ID é obrigatório');
    }
  }

  /**
   * Format cart response
   */
  private formatCartResponse(cart: any): CartResponseDto {
    return {
      id: cart.id,
      tenantId: cart.tenant_id,
      customerPhone: cart.customer_phone,
      items: cart.items || [],
      subtotal: Number(cart.subtotal) || 0,
      couponCode: cart.coupon_code,
      discountAmount: Number(cart.discount_amount) || 0,
      shippingAmount: Number(cart.shipping_amount) || 0,
      totalAmount: Number(cart.total_amount) || 0,
      status: cart.status,
      expiresAt: cart.expires_at?.toISOString(),
      createdAt: cart.created_at?.toISOString(),
      updatedAt: cart.updated_at?.toISOString(),
    };
  }
}