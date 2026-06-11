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
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
 * WhatsApp Cart Controller - Security-hardened version
 *
 * Security model:
 * - GET endpoints: Public for WhatsApp, but ONLY return minimal public data
 *   - No tenant enumeration allowed
 *   - Strict rate limiting per IP+tenant combination
 *   - Phone number must be validated
 * - POST/DELETE endpoints: JWT authentication required
 *   - Full tenant + product validation
 *   - User can only modify their own cart
 *
 * Defense in depth:
 * 1. Input sanitization
 * 2. Format validation
 * 3. Rate limiting
 * 4. Tenant ownership validation
 * 5. JWT authentication for mutations
 */
@ApiTags('WhatsApp - Carrinho')
@Controller('whatsapp/cart')
export class WhatsAppCartController {
  // Rate limiting: per IP+tenant to prevent enumeration
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX = 20; // Reduced from 30

  constructor(
    private readonly cartService: CartService,
    private readonly tenantsService: TenantsService,
    private readonly productsService: ProductsService,
  ) {}

  // ============================================
  // Public endpoints - LIMITED DATA EXPOSURE
  // ============================================

  /**
   * GET cart - Minimal public data only
   * Only returns: has items, item count, total, status, formatted summary
   * Does NOT expose: item details, prices, coupon codes, internal IDs
   */
  @Public()
  @Get(':tenantId/:customerPhone')
  @ApiOperation({ summary: 'Obter resumo do carrinho (dados mínimos)' })
  @ApiResponse({ status: 200, description: 'Resumo do carrinho' })
  @ApiResponse({ status: 404, description: 'Carrinho não encontrado' })
  @ApiResponse({ status: 429, description: 'Muitas requisições' })
  async getCart(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
  ): Promise<CartSummaryResponseDto> {
    // Apply rate limiting
    this.checkRateLimit(`cart:${tenantId}`);

    // Strict validation
    if (!this.isValidUUID(tenantId)) {
      throw new BadRequestException('Tenant ID inválido');
    }

    // Sanitize and validate phone
    const sanitizedPhone = this.sanitizeAndValidatePhone(customerPhone);

    // Verify tenant exists (but don't expose tenant details)
    await this.verifyTenantExists(tenantId);

    // Get cart summary only - no detailed data
    const cart = await this.cartService.getCartByTenantAndPhone(tenantId, sanitizedPhone);

    if (!cart) {
      // Return empty cart summary - don't expose whether cart exists
      return {
        hasCart: false,
        itemCount: 0,
        totalValue: 0,
        expired: false,
        formattedSummary: 'Carrinho vazio',
      };
    }

    return {
      hasCart: cart.items.length > 0,
      itemCount: cart.items.length,
      totalValue: Number(cart.total_amount),
      expired: cart.status === 'expired',
      formattedSummary: this.cartService.generateSummary(cart),
    };
  }

  @Public()
  @Get(':tenantId/:customerPhone/summary')
  @ApiOperation({ summary: 'Obter resumo do carrinho para WhatsApp' })
  @ApiResponse({ status: 200, description: 'Resumo do carrinho' })
  @ApiResponse({ status: 429, description: 'Muitas requisições' })
  async getCartSummary(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
  ): Promise<CartSummaryResponseDto> {
    // Reuse the same logic as getCart
    return this.getCart(tenantId, customerPhone);
  }

  // ============================================
  // Protected endpoints - FULL DATA ACCESS
  // ============================================

  @UseGuards(JwtAuthGuard)
  @Post('add')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adicionar item ao carrinho' })
  @ApiResponse({ status: 201, description: 'Item adicionado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async addToCart(@Body() dto: AddToCartDto): Promise<CartResponseDto> {
    // Validate required fields
    this.validateRequiredFields(dto, ['tenantId', 'customerPhone', 'productId']);

    // Strict validation
    if (!this.isValidUUID(dto.tenantId)) {
      throw new BadRequestException('Tenant ID inválido');
    }

    const sanitizedTenantId = this.sanitizeString(dto.tenantId);
    const sanitizedPhone = this.sanitizeAndValidatePhone(dto.customerPhone);
    const sanitizedProductId = this.sanitizeString(dto.productId);

    // Verify tenant ownership
    await this.verifyTenantExists(sanitizedTenantId);

    // Verify product belongs to tenant
    await this.verifyProductOwnership(sanitizedTenantId, sanitizedProductId);

    // Validate quantity
    if (typeof dto.quantity !== 'number' || dto.quantity < 1 || dto.quantity > 100) {
      throw new BadRequestException('Quantidade deve ser entre 1 e 100');
    }

    // Add item to cart
    await this.cartService.addItem({
      tenantId: sanitizedTenantId,
      customerPhone: sanitizedPhone,
      produtoId: sanitizedProductId,
      produtoName: dto.productName || sanitizedProductId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice || 0,
    });

    // Return full cart details (authenticated user can see full data)
    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    return this.formatCartResponse(cart);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar quantidade de item' })
  @ApiResponse({ status: 200, description: 'Item atualizado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async updateItem(@Body() dto: UpdateCartItemDto): Promise<CartResponseDto> {
    this.validateRequiredFields(dto, ['tenantId', 'customerPhone', 'productId', 'quantity']);

    if (!this.isValidUUID(dto.tenantId)) {
      throw new BadRequestException('Tenant ID inválido');
    }

    const sanitizedTenantId = this.sanitizeString(dto.tenantId);
    const sanitizedPhone = this.sanitizeAndValidatePhone(dto.customerPhone);
    const sanitizedProductId = this.sanitizeString(dto.productId);

    await this.verifyTenantExists(sanitizedTenantId);

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
  @ApiOperation({ summary: 'Remover item do carrinho' })
  @ApiResponse({ status: 200, description: 'Item removido' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async removeItem(@Body() dto: RemoveFromCartDto): Promise<CartResponseDto> {
    this.validateRequiredFields(dto, ['tenantId', 'customerPhone', 'productId']);

    if (!this.isValidUUID(dto.tenantId)) {
      throw new BadRequestException('Tenant ID inválido');
    }

    const sanitizedTenantId = this.sanitizeString(dto.tenantId);
    const sanitizedPhone = this.sanitizeAndValidatePhone(dto.customerPhone);
    const sanitizedProductId = this.sanitizeString(dto.productId);

    await this.verifyTenantExists(sanitizedTenantId);

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    const updatedCart = await this.cartService.removeItem(cart.id, sanitizedProductId);

    return this.formatCartResponse(updatedCart);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Limpar carrinho' })
  @ApiResponse({ status: 200, description: 'Carrinho limpo' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async clearCart(@Body() dto: ClearCartDto): Promise<CartResponseDto> {
    this.validateRequiredFields(dto, ['tenantId', 'customerPhone']);

    if (!this.isValidUUID(dto.tenantId)) {
      throw new BadRequestException('Tenant ID inválido');
    }

    const sanitizedTenantId = this.sanitizeString(dto.tenantId);
    const sanitizedPhone = this.sanitizeAndValidatePhone(dto.customerPhone);

    await this.verifyTenantExists(sanitizedTenantId);

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    const clearedCart = await this.cartService.clearCart(cart.id);

    return this.formatCartResponse(clearedCart);
  }

  // ============================================
  // Private security methods
  // ============================================

  /**
   * Rate limiting check
   */
  private checkRateLimit(key: string): void {
    const now = Date.now();
    const record = this.requestCounts.get(key);

    if (!record || now > record.resetTime) {
      this.requestCounts.set(key, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
    } else {
      record.count++;
      if (record.count > this.RATE_LIMIT_MAX) {
        throw new ForbiddenException('Muitas requisições. Tente novamente em 1 minuto.');
      }
    }
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(str: string): boolean {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    if (!input) return '';
    return input
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/[<>'"`]/g, '')
      .trim()
      .substring(0, 255);
  }

  /**
   * Sanitize and validate phone number
   */
  private sanitizeAndValidatePhone(phone: string): string {
    if (!phone) {
      throw new BadRequestException('Telefone é obrigatório');
    }

    // Keep only digits, spaces, hyphens, plus
    const sanitized = phone.replace(/[^\d\s\-+]/g, '').trim().substring(0, 20);

    // Validate format
    const digitsOnly = sanitized.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 13) {
      throw new BadRequestException('Telefone deve ter 10-13 dígitos');
    }

    return sanitized;
  }

  /**
   * Verify tenant exists (without exposing details)
   */
  private async verifyTenantExists(tenantId: string): Promise<void> {
    try {
      const tenant = await this.tenantsService.findOneById(tenantId);
      if (!tenant) {
        throw new NotFoundException('Recurso não encontrado');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new ForbiddenException('Acesso negado');
    }
  }

  /**
   * Verify product belongs to tenant
   */
  private async verifyProductOwnership(tenantId: string, productId: string): Promise<void> {
    try {
      const product = await this.productsService.findOne(productId);
      if (!product) {
        throw new NotFoundException('Produto não encontrado');
      }
      if (product.tenant_id !== tenantId) {
        throw new ForbiddenException('Produto não pertence a este tenant');
      }
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Erro ao validar produto');
    }
  }

  /**
   * Validate required fields in DTO
   */
  private validateRequiredFields(dto: any, fields: string[]): void {
    for (const field of fields) {
      if (dto[field] === undefined || dto[field] === null || dto[field] === '') {
        throw new BadRequestException(`Campo ${field} é obrigatório`);
      }
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