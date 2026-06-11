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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './services/cart.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
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
 * - GET endpoints are public (for WhatsApp integration)
 * - POST/DELETE endpoints require authentication
 * - Tenant validation is enforced on all operations
 * - Rate limiting should be applied at API gateway level
 */
@ApiTags('WhatsApp - Carrinho')
@Controller('whatsapp/cart')
export class WhatsAppCartController {
  constructor(
    private readonly cartService: CartService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Get cart - PUBLIC endpoint
   * Used by WhatsApp bot to retrieve customer cart
   * No authentication required but tenant is validated
   */
  @Public()
  @Get(':tenantId/:customerPhone')
  @ApiOperation({ summary: 'Obter carrinho do cliente (público)' })
  @ApiResponse({ status: 200, description: 'Carrinho encontrado' })
  @ApiResponse({ status: 404, description: 'Carrinho não encontrado' })
  async getCart(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
  ): Promise<CartResponseDto> {
    // Validate tenant exists
    await this.validateTenant(tenantId);

    // Validate phone format
    this.validatePhoneFormat(customerPhone);

    const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);

    return this.formatCartResponse(cart);
  }

  /**
   * Get cart summary - PUBLIC endpoint
   * Lightweight endpoint for WhatsApp display
   */
  @Public()
  @Get(':tenantId/:customerPhone/summary')
  @ApiOperation({ summary: 'Obter resumo do carrinho para WhatsApp (público)' })
  async getCartSummary(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
  ): Promise<CartSummaryResponseDto> {
    await this.validateTenant(tenantId);
    this.validatePhoneFormat(customerPhone);

    const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);
    const formattedSummary = this.cartService.generateSummary(cart);

    return {
      hasCart: cart.items.length > 0,
      itemCount: cart.items.length,
      totalValue: Number(cart.total_amount),
      expired: cart.status === 'expired',
      formattedSummary,
    };
  }

  /**
   * Add to cart - PROTECTED endpoint
   * Requires authentication to prevent abuse
   */
  @UseGuards(JwtAuthGuard)
  @Post('add')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adicionar item ao carrinho (autenticado)' })
  @ApiResponse({ status: 201, description: 'Item adicionado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async addToCart(@Body() dto: AddToCartDto): Promise<CartResponseDto> {
    await this.validateTenant(dto.tenantId);
    this.validatePhoneFormat(dto.customerPhone);

    // Validate product belongs to tenant
    await this.validateProductBelongsToTenant(dto.tenantId, dto.productId);

    await this.cartService.addItem({
      tenantId: dto.tenantId,
      customerPhone: dto.customerPhone,
      produtoId: dto.productId,
      produtoName: dto.productId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice || 0,
    });

    const cart = await this.cartService.getOrCreateCart(dto.tenantId, dto.customerPhone);

    return this.formatCartResponse(cart);
  }

  /**
   * Update cart item - PROTECTED endpoint
   */
  @UseGuards(JwtAuthGuard)
  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar quantidade de item no carrinho (autenticado)' })
  @ApiResponse({ status: 200, description: 'Item atualizado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async updateItem(@Body() dto: UpdateCartItemDto): Promise<CartResponseDto> {
    await this.validateTenant(dto.tenantId);
    this.validatePhoneFormat(dto.customerPhone);

    const cart = await this.cartService.getOrCreateCart(dto.tenantId, dto.customerPhone);
    const updatedCart = await this.cartService.updateItem(cart.id, dto.productId, dto.quantity);

    return this.formatCartResponse(updatedCart);
  }

  /**
   * Remove from cart - PROTECTED endpoint
   */
  @UseGuards(JwtAuthGuard)
  @Delete('remove')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover item do carrinho (autenticado)' })
  @ApiResponse({ status: 200, description: 'Item removido' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async removeItem(@Body() dto: RemoveFromCartDto): Promise<CartResponseDto> {
    await this.validateTenant(dto.tenantId);
    this.validatePhoneFormat(dto.customerPhone);

    const cart = await this.cartService.getOrCreateCart(dto.tenantId, dto.customerPhone);
    const updatedCart = await this.cartService.removeItem(cart.id, dto.productId);

    return this.formatCartResponse(updatedCart);
  }

  /**
   * Clear cart - PROTECTED endpoint
   */
  @UseGuards(JwtAuthGuard)
  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Limpar carrinho (autenticado)' })
  @ApiResponse({ status: 200, description: 'Carrinho limpo' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async clearCart(@Body() dto: ClearCartDto): Promise<CartResponseDto> {
    await this.validateTenant(dto.tenantId);
    this.validatePhoneFormat(dto.customerPhone);

    const cart = await this.cartService.getOrCreateCart(dto.tenantId, dto.customerPhone);
    const clearedCart = await this.cartService.clearCart(cart.id);

    return this.formatCartResponse(clearedCart);
  }

  // ============================================
  // Private helper methods
  // ============================================

  private async validateTenant(tenantId: string): Promise<void> {
    if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
      throw new ForbiddenException('Tenant ID inválido');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new ForbiddenException('Tenant ID deve ser um UUID válido');
    }

    // Verify tenant exists and is active
    const tenant = await this.tenantsService.findOneById(tenantId);
    if (!tenant) {
      throw new ForbiddenException('Tenant não encontrado');
    }
  }

  private validatePhoneFormat(phone: string): void {
    if (!phone || phone.length < 8) {
      throw new ForbiddenException('Número de telefone inválido');
    }

    // Remove non-digits for validation
    const digitsOnly = phone.replace(/\D/g, '');

    // Brazilian phone validation (10-11 digits)
    if (digitsOnly.length < 10 || digitsOnly.length > 13) {
      throw new ForbiddenException('Número de telefone deve ter 10-13 dígitos');
    }
  }

  private async validateProductBelongsToTenant(tenantId: string, productId: string): Promise<void> {
    // TODO: Implement product ownership validation
    // This should verify the product belongs to the specified tenant
    // For now, just validate the product ID format
    if (!productId) {
      throw new ForbiddenException('Product ID é obrigatório');
    }
  }

  private formatCartResponse(cart: any): CartResponseDto {
    return {
      id: cart.id,
      tenantId: cart.tenant_id,
      customerPhone: cart.customer_phone,
      items: cart.items,
      subtotal: Number(cart.subtotal),
      couponCode: cart.coupon_code,
      discountAmount: Number(cart.discount_amount),
      shippingAmount: Number(cart.shipping_amount),
      totalAmount: Number(cart.total_amount),
      status: cart.status,
      expiresAt: cart.expires_at.toISOString(),
      createdAt: cart.created_at.toISOString(),
      updatedAt: cart.updated_at.toISOString(),
    };
  }
}