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
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import * as crypto from 'crypto';
import { CartService } from './services/cart.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ProductsService } from '../products/products.service';
import { sanitizeAuditDetails } from '../../common/utils/mask.util';

/**
 * WhatsApp Cart Controller - Maximum Security Version
 *
 * SECURITY CONTROLS:
 *
 * 1. AUTHENTICATION:
 *    - JWT required for all mutation operations
 *    - Token must contain: sub (user ID), tenant_id (tenant UUID)
 *    - Token signature verification via JwtAuthGuard
 *
 * 2. AUTHORIZATION (Defense in Depth):
 *    a) Token validation (JwtAuthGuard)
 *    b) Tenant ownership verification (verifyUserOwnsTenant)
 *    c) Product ownership verification (verifyProductOwnership)
 *
 * 3. INPUT VALIDATION:
 *    a) UUID format validation (regex)
 *    b) Phone format validation (10-13 digits)
 *    c) Type checking for all fields
 *    d) Range validation (quantity 1-100)
 *
 * 4. RATE LIMITING:
 *    a) IP-based global rate limiting
 *    b) IP blocking after violations
 *    c) Tenant enumeration prevention
 *
 * 5. AUDIT:
 *    a) All mutations logged with user context
 *    b) Security violations logged
 */
@ApiTags('WhatsApp - Carrinho')
@Controller('whatsapp/cart')
export class WhatsAppCartController {
  // Global rate limiting (prevents tenant enumeration)
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private blockedIPs = new Set<string>();
  private readonly RATE_LIMIT_WINDOW_MS = 60000;
  private readonly RATE_LIMIT_MAX_REQUESTS = 30;
  private readonly MAX_VIOLATIONS_BEFORE_BLOCK = 3;
  private ipViolationCounts = new Map<string, number>();
  private readonly logger = new Logger(WhatsAppCartController.name);

  constructor(
    private readonly cartService: CartService,
    private readonly tenantsService: TenantsService,
    private readonly productsService: ProductsService,
  ) {}

  // ============================================
  // PUBLIC ENDPOINTS (Rate Limited, Minimal Data)
  // ============================================

  /**
   * Get cart summary - Public endpoint
   * Returns ONLY: hasCart, itemCount, totalValue, expired, formattedSummary
   * NO sensitive data exposed (no IDs, prices, items detail)
   */
  @Public()
  @Get(':tenantId/:customerPhone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get cart summary (public, rate-limited)' })
  async getCart(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
    @Req() request: Request,
  ): Promise<CartSummaryResponseDto> {
    const clientIp = this.getClientIp(request);

    // 1. Check IP block status
    this.throwIfIpBlocked(clientIp);

    // 2. Apply rate limiting
    this.checkRateLimit(clientIp);

    // 3. Validate tenant UUID format
    this.validateTenantIdFormat(tenantId);

    // 4. Validate and sanitize phone
    const cleanPhone = this.validateAndSanitizePhone(customerPhone);

    // 5. Verify tenant exists (but return generic error)
    await this.checkTenantExists(tenantId);

    // 6. Get cart data (no creation)
    const cart = await this.cartService.getCartByTenantAndPhone(tenantId, cleanPhone);

    // 7. Return minimal summary (no existence confirmation)
    return this.buildMinimalCartSummary(cart);
  }

  /**
   * Get cart summary - alias for WhatsApp integration
   */
  @Public()
  @Get(':tenantId/:customerPhone/summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get cart summary for WhatsApp' })
  async getCartSummary(
    @Param('tenantId') tenantId: string,
    @Param('customerPhone') customerPhone: string,
    @Req() request: Request,
  ): Promise<CartSummaryResponseDto> {
    return this.getCart(tenantId, customerPhone, request);
  }

  // ============================================
  // PROTECTED ENDPOINTS (JWT + Authorization)
  // ============================================

  /**
   * Add item to cart - REQUIRES JWT AUTHENTICATION
   * Authorization: user.tenant_id MUST match dto.tenantId
   */
  @UseGuards(JwtAuthGuard)
  @Post('add')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add item to cart (authenticated)' })
  async addToCart(
    @Body() body: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<CartResponseDto> {
    // 1. Extract and validate user from JWT
    const authContext = this.extractAndValidateAuthContext(request);

    // 2. Parse and validate DTO
    const dto = this.parseAndValidateAddToCartDto(body);

    // 3. Authorization: Verify user owns the tenant
    this.assertUserOwnsTenant(authContext.userId, authContext.tenantId, dto.tenantId);

    // 4. Sanitize all inputs
    const cleanTenantId = this.sanitizeAndValidateUuid(dto.tenantId);
    const cleanPhone = this.validateAndSanitizePhone(dto.customerPhone);
    const cleanProductId = this.sanitizeString(dto.productId);
    const cleanQuantity = this.validateQuantity(dto.quantity);

    // 5. Verify product belongs to tenant
    await this.assertProductBelongsToTenant(cleanTenantId, cleanProductId);

    // 6. Perform operation
    await this.cartService.addItem({
      tenantId: cleanTenantId,
      customerPhone: cleanPhone,
      produtoId: cleanProductId,
      produtoName: this.sanitizeString(dto.productName || ''),
      quantity: cleanQuantity,
      unitPrice: Number(dto.unitPrice) || 0,
    });

    // 7. Audit log
    this.auditLog(authContext.userId, authContext.tenantId, 'ADD_ITEM', { productId: cleanProductId });

    // 8. Return response
    const cart = await this.cartService.getOrCreateCart(cleanTenantId, cleanPhone);
    return this.buildFullCartResponse(cart);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update item quantity (authenticated)' })
  async updateItem(
    @Body() body: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<CartResponseDto> {
    const authContext = this.extractAndValidateAuthContext(request);
    const dto = this.parseAndValidateUpdateCartDto(body);

    this.assertUserOwnsTenant(authContext.userId, authContext.tenantId, dto.tenantId);

    const cleanTenantId = this.sanitizeAndValidateUuid(dto.tenantId);
    const cleanPhone = this.validateAndSanitizePhone(dto.customerPhone);
    const cleanProductId = this.sanitizeString(dto.productId);
    const cleanQuantity = this.validateQuantity(dto.quantity, true);

    const cart = await this.cartService.getOrCreateCart(cleanTenantId, cleanPhone);
    const updatedCart = await this.cartService.updateItem(cart.id, cleanProductId, cleanQuantity);

    this.auditLog(authContext.userId, authContext.tenantId, 'UPDATE_ITEM', { productId: cleanProductId, quantity: cleanQuantity });

    return this.buildFullCartResponse(updatedCart);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('remove')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove item from cart (authenticated)' })
  async removeItem(
    @Body() body: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<CartResponseDto> {
    const authContext = this.extractAndValidateAuthContext(request);
    const dto = this.parseAndValidateRemoveCartDto(body);

    this.assertUserOwnsTenant(authContext.userId, authContext.tenantId, dto.tenantId);

    const cleanTenantId = this.sanitizeAndValidateUuid(dto.tenantId);
    const cleanPhone = this.validateAndSanitizePhone(dto.customerPhone);
    const cleanProductId = this.sanitizeString(dto.productId);

    const cart = await this.cartService.getOrCreateCart(cleanTenantId, cleanPhone);
    const updatedCart = await this.cartService.removeItem(cart.id, cleanProductId);

    this.auditLog(authContext.userId, authContext.tenantId, 'REMOVE_ITEM', { productId: cleanProductId });

    return this.buildFullCartResponse(updatedCart);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear cart (authenticated)' })
  async clearCart(
    @Body() body: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<CartResponseDto> {
    const authContext = this.extractAndValidateAuthContext(request);
    const dto = this.parseAndValidateClearCartDto(body);

    this.assertUserOwnsTenant(authContext.userId, authContext.tenantId, dto.tenantId);

    const cleanTenantId = this.sanitizeAndValidateUuid(dto.tenantId);
    const cleanPhone = this.validateAndSanitizePhone(dto.customerPhone);

    const cart = await this.cartService.getOrCreateCart(cleanTenantId, cleanPhone);
    const clearedCart = await this.cartService.clearCart(cart.id);

    this.auditLog(authContext.userId, authContext.tenantId, 'CLEAR_CART', {});

    return this.buildFullCartResponse(clearedCart);
  }

  // ============================================
  // PRIVATE SECURITY METHODS
  // ============================================

  /**
   * Get client IP (handles proxies)
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || '127.0.0.1';
  }

  /**
   * Throw if IP is blocked
   */
  private throwIfIpBlocked(ip: string): void {
    if (this.blockedIPs.has(ip)) {
      this.auditLog('SYSTEM', 'SYSTEM', 'IP_BLOCKED', { ip });
      throw new ForbiddenException('Access denied');
    }
  }

  /**
   * Global rate limiting (per IP, not per tenant)
   */
  private checkRateLimit(ip: string): void {
    const now = Date.now();
    const record = this.rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(ip, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW_MS });
    } else {
      record.count++;
      if (record.count > this.RATE_LIMIT_MAX_REQUESTS) {
        this.recordRateLimitViolation(ip);
        throw new ForbiddenException('Rate limit exceeded');
      }
    }
  }

  /**
   * Record violation and block IP if threshold reached
   */
  private recordRateLimitViolation(ip: string): void {
    const violations = (this.ipViolationCounts.get(ip) || 0) + 1;
    this.ipViolationCounts.set(ip, violations);

    this.auditLog('SYSTEM', 'SYSTEM', 'RATE_LIMIT_VIOLATION', { ip, violations });

    if (violations >= this.MAX_VIOLATIONS_BEFORE_BLOCK) {
      this.blockedIPs.add(ip);
      this.auditLog('SYSTEM', 'SYSTEM', 'IP_BLOCKED', { ip, reason: 'max_violations' });
    }
  }

  /**
   * Extract and validate authentication context from JWT
   */
  private extractAndValidateAuthContext(request: Request): { userId: string; tenantId: string } {
    const user = (request as any).user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Validate user ID
    if (!user.sub || typeof user.sub !== 'string') {
      throw new UnauthorizedException('Invalid token: missing user ID');
    }

    // Validate tenant ID
    if (!user.tenant_id || typeof user.tenant_id !== 'string') {
      throw new UnauthorizedException('Invalid token: missing tenant ID');
    }

    // Validate tenant ID format
    if (!this.isValidUuid(user.tenant_id)) {
      throw new UnauthorizedException('Invalid token: malformed tenant ID');
    }

    return {
      userId: user.sub,
      tenantId: user.tenant_id.toLowerCase(),
    };
  }

  /**
   * Assert user owns the tenant they're trying to access
   * THROWS: ForbiddenException if authorization fails
   */
  private assertUserOwnsTenant(userId: string, userTenantId: string, requestedTenantId: string): void {
    // Sanitize requested tenant
    const cleanRequestedTenant = requestedTenantId.toLowerCase().trim();

    // Constant-time comparison to prevent timing attacks
    const userTenantBytes = Buffer.from(userTenantId);
    const requestedBytes = Buffer.from(cleanRequestedTenant);

    if (userTenantBytes.length !== requestedBytes.length) {
      this.auditSecurityViolation(userId, userTenantId, cleanRequestedTenant, 'TENANT_MISMATCH');
      throw new ForbiddenException('Access denied');
    }

    if (!crypto.timingSafeEqual(userTenantBytes, requestedBytes)) {
      this.auditSecurityViolation(userId, userTenantId, cleanRequestedTenant, 'TENANT_MISMATCH');
      throw new ForbiddenException('Access denied');
    }
  }

  /**
   * Log security violations
   */
  private auditSecurityViolation(userId: string, userTenant: string, attemptedTenant: string, reason: string): void {
    // logger.error -> "level":"error" no formato estruturado -> chega no app-alert (Telegram).
    // IDs sao UUIDs internos (nao PII de contato); mantidos no evento de seguranca.
    this.logger.error(
      `[SECURITY_VIOLATION] user=${userId} owns=${userTenant} attempted=${attemptedTenant} reason=${reason}`,
    );
  }

  /**
   * Audit log for all operations
   */
  private auditLog(userId: string, tenantId: string, action: string, details: Record<string, unknown>): void {
    // Auditoria operacional (nivel info, estruturado). Sanitiza o details antes de
    // logar — pode trazer PII dos chamadores (ex.: ip).
    this.logger.log(
      `[AUDIT] user=${userId} tenant=${tenantId} action=${action} details=${JSON.stringify(sanitizeAuditDetails(details))}`,
    );
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate tenant ID is valid UUID format
   */
  private validateTenantIdFormat(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new BadRequestException('Invalid request');
    }
    if (!this.isValidUuid(tenantId)) {
      throw new BadRequestException('Invalid request');
    }
  }

  /**
   * Check if string is valid UUID v4
   */
  private isValidUuid(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str.trim());
  }

  /**
   * Sanitize and validate UUID (returns lowercase)
   */
  private sanitizeAndValidateUuid(input: string): string {
    if (!input || typeof input !== 'string') {
      throw new BadRequestException('Invalid tenant ID');
    }
    const cleaned = input.toLowerCase().trim();
    if (!this.isValidUuid(cleaned)) {
      throw new BadRequestException('Invalid tenant ID');
    }
    return cleaned;
  }

  /**
   * Validate and sanitize phone number
   */
  private validateAndSanitizePhone(phone: unknown): string {
    if (!phone || typeof phone !== 'string') {
      throw new BadRequestException('Phone number required');
    }

    const cleaned = phone.replace(/[^\d\+]/g, '').trim().substring(0, 20);

    if (cleaned.length < 10 || cleaned.length > 13) {
      throw new BadRequestException('Invalid phone format');
    }

    return cleaned;
  }

  /**
   * Sanitize general string input
   */
  private sanitizeString(input: unknown): string {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[<>'"`;\\]/g, '').trim().substring(0, 255);
  }

  /**
   * Validate quantity (with optional allowZero)
   */
  private validateQuantity(quantity: unknown, allowZero = false): number {
    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
      throw new BadRequestException('Invalid quantity');
    }

    const min = allowZero ? 0 : 1;
    const max = 100;

    if (quantity < min || quantity > max) {
      throw new BadRequestException(`Quantity must be ${min}-${max}`);
    }

    return Math.floor(quantity);
  }

  /**
   * Verify tenant exists
   */
  private async checkTenantExists(tenantId: string): Promise<void> {
    try {
      await this.tenantsService.findOneById(tenantId);
    } catch {
      throw new BadRequestException('Invalid request');
    }
  }

  /**
   * Assert product belongs to tenant
   */
  private async assertProductBelongsToTenant(tenantId: string, productId: string): Promise<void> {
    const product = await this.productsService.findOne(productId, tenantId);

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    if (product.tenant_id !== tenantId) {
      this.auditLog('SYSTEM', tenantId, 'PRODUCT_ACCESS_VIOLATION', { productId });
      throw new ForbiddenException('Access denied');
    }
  }

  // ============================================
  // DTO PARSING METHODS
  // ============================================

  private parseAndValidateAddToCartDto(body: Record<string, unknown>): {
    tenantId: string;
    customerPhone: string;
    productId: string;
    productName?: string;
    quantity: number;
    unitPrice?: number;
  } {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    const tenantId = body.tenantId as string;
    const customerPhone = body.customerPhone as string;
    const productId = body.productId as string;
    const productName = body.productName as string | undefined;
    const quantity = body.quantity as number;
    const unitPrice = typeof body.unitPrice === 'number' ? body.unitPrice as number : undefined;

    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!customerPhone) throw new BadRequestException('Customer phone required');
    if (!productId) throw new BadRequestException('Product ID required');
    if (quantity === undefined || quantity === null) throw new BadRequestException('Quantity required');

    return { tenantId, customerPhone, productId, productName, quantity, unitPrice };
  }

  private parseAndValidateUpdateCartDto(body: Record<string, unknown>): {
    tenantId: string;
    customerPhone: string;
    productId: string;
    quantity: number;
  } {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    const tenantId = body.tenantId as string;
    const customerPhone = body.customerPhone as string;
    const productId = body.productId as string;
    const quantity = body.quantity as number;

    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!customerPhone) throw new BadRequestException('Customer phone required');
    if (!productId) throw new BadRequestException('Product ID required');
    if (quantity === undefined || quantity === null) throw new BadRequestException('Quantity required');

    return { tenantId, customerPhone, productId, quantity };
  }

  private parseAndValidateRemoveCartDto(body: Record<string, unknown>): {
    tenantId: string;
    customerPhone: string;
    productId: string;
  } {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    const tenantId = body.tenantId as string;
    const customerPhone = body.customerPhone as string;
    const productId = body.productId as string;

    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!customerPhone) throw new BadRequestException('Customer phone required');
    if (!productId) throw new BadRequestException('Product ID required');

    return { tenantId, customerPhone, productId };
  }

  private parseAndValidateClearCartDto(body: Record<string, unknown>): {
    tenantId: string;
    customerPhone: string;
  } {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    const tenantId = body.tenantId as string;
    const customerPhone = body.customerPhone as string;

    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!customerPhone) throw new BadRequestException('Customer phone required');

    return { tenantId, customerPhone };
  }

  // ============================================
  // RESPONSE BUILDERS
  // ============================================

  private buildMinimalCartSummary(cart: any): CartSummaryResponseDto {
    return {
      hasCart: cart?.items?.length > 0 || false,
      itemCount: cart?.items?.length || 0,
      totalValue: Number(cart?.total_amount) || 0,
      expired: cart?.status === 'expired' || false,
      formattedSummary: this.cartService.generateSummary(cart),
    };
  }

  private buildFullCartResponse(cart: any): CartResponseDto {
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

// Type definitions (for documentation)
interface CartResponseDto {
  id: string;
  tenantId: string;
  customerPhone: string;
  items: any[];
  subtotal: number;
  couponCode: string | null;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

interface CartSummaryResponseDto {
  hasCart: boolean;
  itemCount: number;
  totalValue: number;
  expired: boolean;
  formattedSummary: string;
}