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
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CartService } from './services/cart.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ProductsService } from '../products/products.service';
import { TenantsModule } from '../tenants/tenants.module';

/**
 * WhatsApp Cart Controller - Final Security-hardened version
 *
 * SECURITY ARCHITECTURE:
 *
 * 1. Authorization Model:
 *    - Users can ONLY access their own tenant's data
 *    - JWT token must contain tenant_id claim
 *    - All mutations verify: token.tenant_id === requested.tenant_id
 *
 * 2. Rate Limiting:
 *    - Global rate limit (not per-tenant) to prevent enumeration
 *    - IP-based tracking with sliding window
 *    - Blocks after 3 violations per IP
 *
 * 3. Input Validation:
 *    - UUID format validation
 *    - Phone number format validation (E.164 compatible)
 *    - Type checking for all inputs
 *
 * 4. Audit Trail:
 *    - All mutations logged with user context
 */
@ApiTags('WhatsApp - Carrinho')
@Controller('whatsapp/cart')
export class WhatsAppCartController {
  // Global rate limiting (prevents tenant enumeration)
  private globalRateLimit = new Map<string, { count: number; resetTime: number }>();
  private blockedIPs = new Set<string>();
  private readonly RATE_LIMIT_WINDOW = 60000;
  private readonly RATE_LIMIT_MAX = 30;
  private readonly MAX_VIOLATIONS = 3;
  private violationCounts = new Map<string, number>();

  constructor(
    private readonly cartService: CartService,
    private readonly tenantsService: TenantsService,
    private readonly productsService: ProductsService,
  ) {}

  // ============================================
  // Public endpoints - READ ONLY WITH THROTTLING
  // ============================================

  /**
   * Get cart summary - PUBLIC but heavily rate-limited
   * Returns ONLY summary data, no sensitive details
   */
  @Public()
  @Get(':tenantId/:customerPhone')
  @ApiOperation({ summary: 'Obter resumo do carrinho' })
  @ApiResponse({ status: 200, description: 'Resumo do carrinho' })
  @ApiResponse({ status: 429, description: 'Bloqueado' })
  async getCart(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
    @Req() request: Request,
  ): Promise<CartSummaryResponseDto> {
    const clientIp = this.extractClientIp(request);

    // Check if IP is blocked
    if (this.isIpBlocked(clientIp)) {
      throw new ForbiddenException('Acesso temporariamente bloqueado.');
    }

    // Apply global rate limit
    this.checkGlobalRateLimit(clientIp);

    // Strict UUID validation
    if (!this.isValidUUID(tenantId)) {
      throw new BadRequestException('Invalid request');
    }

    // Sanitize phone
    const sanitizedPhone = this.sanitizePhone(customerPhone);

    // Verify tenant exists
    await this.verifyTenantExists(tenantId);

    // Get cart (doesn't create)
    const cart = await this.cartService.getCartByTenantAndPhone(tenantId, sanitizedPhone);

    // Return minimal summary - no existence leak
    return {
      hasCart: cart?.items?.length > 0 || false,
      itemCount: cart?.items?.length || 0,
      totalValue: Number(cart?.total_amount) || 0,
      expired: cart?.status === 'expired' || false,
      formattedSummary: this.cartService.generateSummary(cart),
    };
  }

  @Public()
  @Get(':tenantId/:customerPhone/summary')
  @ApiOperation({ summary: 'Obter resumo do carrinho para WhatsApp' })
  async getCartSummary(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
    @Req() request: Request,
  ): Promise<CartSummaryResponseDto> {
    return this.getCart(tenantId, customerPhone, request);
  }

  // ============================================
  // Protected endpoints - FULL VALIDATION
  // ============================================

  @UseGuards(JwtAuthGuard)
  @Post('add')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adicionar item ao carrinho' })
  async addToCart(
    @Body() dto: AddToCartDto,
    @Req() request: Request,
  ): Promise<CartResponseDto> {
    // Extract user context from JWT
    const user = this.extractUserFromRequest(request);

    // Validate DTO fields
    this.validateAddToCartDto(dto);

    // Authorization: User can only access their own tenant
    this.verifyUserOwnsTenant(user, dto.tenantId);

    // Sanitize inputs
    const sanitizedTenantId = this.sanitizeUUID(dto.tenantId);
    const sanitizedPhone = this.sanitizePhone(dto.customerPhone);
    const sanitizedProductId = this.sanitizeString(dto.productId);

    // Verify product belongs to tenant
    await this.verifyProductOwnership(sanitizedTenantId, sanitizedProductId);

    // Add item
    await this.cartService.addItem({
      tenantId: sanitizedTenantId,
      customerPhone: sanitizedPhone,
      produtoId: sanitizedProductId,
      produtoName: dto.productName || sanitizedProductId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice || 0,
    });

    // Audit log
    this.logMutation(user, 'add', { tenantId: sanitizedTenantId, productId: sanitizedProductId });

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    return this.formatCartResponse(cart);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar quantidade de item' })
  async updateItem(
    @Body() dto: UpdateCartItemDto,
    @Req() request: Request,
  ): Promise<CartResponseDto> {
    const user = this.extractUserFromRequest(request);
    this.validateUpdateDto(dto);
    this.verifyUserOwnsTenant(user, dto.tenantId);

    const sanitizedTenantId = this.sanitizeUUID(dto.tenantId);
    const sanitizedPhone = this.sanitizePhone(dto.customerPhone);
    const sanitizedProductId = this.sanitizeString(dto.productId);

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    const updatedCart = await this.cartService.updateItem(cart.id, sanitizedProductId, dto.quantity);

    this.logMutation(user, 'update', { tenantId: sanitizedTenantId, productId: sanitizedProductId, quantity: dto.quantity });

    return this.formatCartResponse(updatedCart);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('remove')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover item do carrinho' })
  async removeItem(
    @Body() dto: RemoveFromCartDto,
    @Req() request: Request,
  ): Promise<CartResponseDto> {
    const user = this.extractUserFromRequest(request);
    this.validateRemoveDto(dto);
    this.verifyUserOwnsTenant(user, dto.tenantId);

    const sanitizedTenantId = this.sanitizeUUID(dto.tenantId);
    const sanitizedPhone = this.sanitizePhone(dto.customerPhone);
    const sanitizedProductId = this.sanitizeString(dto.productId);

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    const updatedCart = await this.cartService.removeItem(cart.id, sanitizedProductId);

    this.logMutation(user, 'remove', { tenantId: sanitizedTenantId, productId: sanitizedProductId });

    return this.formatCartResponse(updatedCart);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Limpar carrinho' })
  async clearCart(
    @Body() dto: ClearCartDto,
    @Req() request: Request,
  ): Promise<CartResponseDto> {
    const user = this.extractUserFromRequest(request);
    this.validateClearDto(dto);
    this.verifyUserOwnsTenant(user, dto.tenantId);

    const sanitizedTenantId = this.sanitizeUUID(dto.tenantId);
    const sanitizedPhone = this.sanitizePhone(dto.customerPhone);

    const cart = await this.cartService.getOrCreateCart(sanitizedTenantId, sanitizedPhone);
    const clearedCart = await this.cartService.clearCart(cart.id);

    this.logMutation(user, 'clear', { tenantId: sanitizedTenantId });

    return this.formatCartResponse(clearedCart);
  }

  // ============================================
  // Security helper methods
  // ============================================

  /**
   * Extract client IP from request (handles proxies)
   */
  private extractClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Extract user context from JWT token
   */
  private extractUserFromRequest(request: Request): { userId: string; tenantId: string } {
    // User is attached to request by JWT guard
    const user = (request as any).user;

    if (!user || !user.sub || !user.tenantId) {
      throw new UnauthorizedException('Invalid authentication');
    }

    return {
      userId: user.sub,
      tenantId: user.tenantId,
    };
  }

  /**
   * Verify user owns the tenant they're trying to access
   * This prevents horizontal privilege escalation
   */
  private verifyUserOwnsTenant(user: { userId: string; tenantId: string }, requestedTenantId: string): void {
    // Sanitize the requested tenant ID
    const sanitizedRequestedTenant = this.sanitizeUUID(requestedTenantId);

    // Compare user's tenant with requested tenant
    if (user.tenantId !== sanitizedRequestedTenant) {
      // Log security event
      console.error(`[SECURITY] User ${user.userId} attempted to access tenant ${sanitizedRequestedTenant} but owns ${user.tenantId}`);
      throw new ForbiddenException('Access denied');
    }
  }

  /**
   * Global rate limiting - prevents tenant enumeration
   */
  private checkGlobalRateLimit(clientIp: string): void {
    const now = Date.now();
    const record = this.globalRateLimit.get(clientIp);

    if (!record || now > record.resetTime) {
      this.globalRateLimit.set(clientIp, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
    } else {
      record.count++;
      if (record.count > this.RATE_LIMIT_MAX) {
        this.recordViolation(clientIp);
        throw new ForbiddenException('Rate limit exceeded');
      }
    }
  }

  /**
   * Track violations and block IPs after threshold
   */
  private recordViolation(clientIp: string): void {
    const violations = (this.violationCounts.get(clientIp) || 0) + 1;
    this.violationCounts.set(clientIp, violations);

    if (violations >= this.MAX_VIOLATIONS) {
      this.blockedIPs.add(clientIp);
      console.error(`[SECURITY] IP ${clientIp} blocked due to rate limit violations`);
    }
  }

  /**
   * Check if IP is blocked
   */
  private isIpBlocked(clientIp: string): boolean {
    return this.blockedIPs.has(clientIp);
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Sanitize UUID (returns lowercase)
   */
  private sanitizeUUID(input: string): string {
    if (!input || typeof input !== 'string') {
      throw new BadRequestException('Invalid tenant ID');
    }
    return input.toLowerCase().trim();
  }

  /**
   * Sanitize string
   */
  private sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[<>'"`;]/g, '').trim().substring(0, 255);
  }

  /**
   * Sanitize phone number (E.164 compatible)
   */
  private sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      throw new BadRequestException('Phone number required');
    }
    // Keep only digits, +, and spaces
    const sanitized = phone.replace(/[^\d\+ ]/g, '').trim().substring(0, 20);
    const digitsOnly = sanitized.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 13) {
      throw new BadRequestException('Invalid phone format');
    }
    return sanitized;
  }

  /**
   * Verify tenant exists
   */
  private async verifyTenantExists(tenantId: string): Promise<void> {
    try {
      await this.tenantsService.findOneById(tenantId);
    } catch {
      throw new BadRequestException('Invalid request');
    }
  }

  /**
   * Verify product belongs to tenant
   */
  private async verifyProductOwnership(tenantId: string, productId: string): Promise<void> {
    const product = await this.productsService.findOne(productId);
    if (!product) {
      throw new BadRequestException('Product not found');
    }
    if (product.tenant_id !== tenantId) {
      throw new ForbiddenException('Access denied');
    }
  }

  /**
   * Validate DTOs
   */
  private validateAddToCartDto(dto: AddToCartDto): void {
    if (!dto?.tenantId || !this.isValidUUID(dto.tenantId)) {
      throw new BadRequestException('Invalid tenant ID');
    }
    if (!dto?.customerPhone) {
      throw new BadRequestException('Phone required');
    }
    if (!dto?.productId) {
      throw new BadRequestException('Product ID required');
    }
    if (typeof dto?.quantity !== 'number' || dto.quantity < 1 || dto.quantity > 100) {
      throw new BadRequestException('Quantity must be 1-100');
    }
  }

  private validateUpdateDto(dto: UpdateCartItemDto): void {
    if (!dto?.tenantId || !this.isValidUUID(dto.tenantId)) {
      throw new BadRequestException('Invalid tenant ID');
    }
    if (!dto?.customerPhone || !dto?.productId) {
      throw new BadRequestException('Missing required fields');
    }
    if (typeof dto?.quantity !== 'number' || dto.quantity < 0 || dto.quantity > 100) {
      throw new BadRequestException('Invalid quantity');
    }
  }

  private validateRemoveDto(dto: RemoveFromCartDto): void {
    if (!dto?.tenantId || !this.isValidUUID(dto.tenantId)) {
      throw new BadRequestException('Invalid tenant ID');
    }
    if (!dto?.customerPhone || !dto?.productId) {
      throw new BadRequestException('Missing required fields');
    }
  }

  private validateClearDto(dto: ClearCartDto): void {
    if (!dto?.tenantId || !this.isValidUUID(dto.tenantId)) {
      throw new BadRequestException('Invalid tenant ID');
    }
    if (!dto?.customerPhone) {
      throw new BadRequestException('Phone required');
    }
  }

  /**
   * Audit logging
   */
  private logMutation(user: { userId: string; tenantId: string }, action: string, details: object): void {
    console.log(`[AUDIT] user=${user.userId} tenant=${user.tenantId} action=${action} details=${JSON.stringify(details)}`);
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

// Type definitions
interface AddToCartDto {
  tenantId: string;
  customerPhone: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice?: number;
}

interface UpdateCartItemDto {
  tenantId: string;
  customerPhone: string;
  productId: string;
  quantity: number;
}

interface RemoveFromCartDto {
  tenantId: string;
  customerPhone: string;
  productId: string;
}

interface ClearCartDto {
  tenantId: string;
  customerPhone: string;
}