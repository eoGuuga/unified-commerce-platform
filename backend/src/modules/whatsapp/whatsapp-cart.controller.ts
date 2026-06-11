import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CartService } from './services/cart.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  RemoveFromCartDto,
  ClearCartDto,
  CartResponseDto,
  CartSummaryResponseDto,
} from './dto/cart.dto';

@ApiTags('WhatsApp - Carrinho')
@Controller('whatsapp/cart')
export class WhatsAppCartController {
  constructor(
    private readonly cartService: CartService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Get(':tenantId/:customerPhone')
  @ApiOperation({ summary: 'Obter carrinho do cliente' })
  @ApiResponse({ status: 200, description: 'Carrinho encontrado' })
  @ApiResponse({ status: 404, description: 'Carrinho não encontrado' })
  async getCart(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
  ): Promise<CartResponseDto> {
    await this.tenantsService.findOneById(tenantId);

    const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);

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

  @Get(':tenantId/:customerPhone/summary')
  @ApiOperation({ summary: 'Obter resumo do carrinho para WhatsApp' })
  async getCartSummary(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
  ): Promise<CartSummaryResponseDto> {
    await this.tenantsService.findOneById(tenantId);

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

  @Post('add')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adicionar item ao carrinho' })
  async addToCart(@Body() dto: AddToCartDto): Promise<CartResponseDto> {
    await this.tenantsService.findOneById(dto.tenantId);

    await this.cartService.addItem({
      tenantId: dto.tenantId,
      customerPhone: dto.customerPhone,
      produtoId: dto.productId,
      produtoName: dto.productId, // Nome não disponível no DTO
      quantity: dto.quantity,
      unitPrice: 0, // Preço não disponível no DTO
    });

    const cart = await this.cartService.getOrCreateCart(dto.tenantId, dto.customerPhone);

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

  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar quantidade de item no carrinho' })
  async updateItem(@Body() dto: UpdateCartItemDto): Promise<CartResponseDto> {
    await this.tenantsService.findOneById(dto.tenantId);

    const cart = await this.cartService.getOrCreateCart(dto.tenantId, dto.customerPhone);
    const updatedCart = await this.cartService.updateItem(cart.id, dto.productId, dto.quantity);

    return {
      id: updatedCart.id,
      tenantId: updatedCart.tenant_id,
      customerPhone: updatedCart.customer_phone,
      items: updatedCart.items,
      subtotal: Number(updatedCart.subtotal),
      couponCode: updatedCart.coupon_code,
      discountAmount: Number(updatedCart.discount_amount),
      shippingAmount: Number(updatedCart.shipping_amount),
      totalAmount: Number(updatedCart.total_amount),
      status: updatedCart.status,
      expiresAt: updatedCart.expires_at.toISOString(),
      createdAt: updatedCart.created_at.toISOString(),
      updatedAt: updatedCart.updated_at.toISOString(),
    };
  }

  @Delete('remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover item do carrinho' })
  async removeItem(@Body() dto: RemoveFromCartDto): Promise<CartResponseDto> {
    await this.tenantsService.findOneById(dto.tenantId);

    const cart = await this.cartService.getOrCreateCart(dto.tenantId, dto.customerPhone);
    const updatedCart = await this.cartService.removeItem(cart.id, dto.productId);

    return {
      id: updatedCart.id,
      tenantId: updatedCart.tenant_id,
      customerPhone: updatedCart.customer_phone,
      items: updatedCart.items,
      subtotal: Number(updatedCart.subtotal),
      couponCode: updatedCart.coupon_code,
      discountAmount: Number(updatedCart.discount_amount),
      shippingAmount: Number(updatedCart.shipping_amount),
      totalAmount: Number(updatedCart.total_amount),
      status: updatedCart.status,
      expiresAt: updatedCart.expires_at.toISOString(),
      createdAt: updatedCart.created_at.toISOString(),
      updatedAt: updatedCart.updated_at.toISOString(),
    };
  }

  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Limpar carrinho' })
  async clearCart(@Body() dto: ClearCartDto): Promise<CartResponseDto> {
    await this.tenantsService.findOneById(dto.tenantId);

    const cart = await this.cartService.getOrCreateCart(dto.tenantId, dto.customerPhone);
    const clearedCart = await this.cartService.clearCart(cart.id);

    return {
      id: clearedCart.id,
      tenantId: clearedCart.tenant_id,
      customerPhone: clearedCart.customer_phone,
      items: clearedCart.items,
      subtotal: Number(clearedCart.subtotal),
      couponCode: clearedCart.coupon_code,
      discountAmount: Number(clearedCart.discount_amount),
      shippingAmount: Number(clearedCart.shipping_amount),
      totalAmount: Number(clearedCart.total_amount),
      status: clearedCart.status,
      expiresAt: clearedCart.expires_at.toISOString(),
      createdAt: clearedCart.created_at.toISOString(),
      updatedAt: clearedCart.updated_at.toISOString(),
    };
  }
}