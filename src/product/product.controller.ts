import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  CreateProductDto,
  UpdateProductDto,
  AdminViewProductsPaginationDto,
} from './dto';
import { ApiError, ApiResponse, RolesGuard } from 'src/common';
import { Product, Sale } from '../../generated/prisma/client';
import { FileUpload } from 'src/common/decorators/file-upload.decorator';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ─── ADMIN ────────────────────────────────────────
  @Post()
  @FileUpload({
    fieldName: 'image',
    destination: './uploads',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createProduct(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateProductDto,
    @Req() req: any,
  ): Promise<ApiResponse<Product>> {
    const userId = req.user.id;
    console.log('userId', userId);
    if (!file) throw new ApiError(400, 'Image is required');
    const imagePath = `/uploads/${file.filename}`;
    const product = await this.productService.createProduct({
      ...dto,
      userId,
      image: imagePath,
    });
    return new ApiResponse(201, product, 'Product created');
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async viewAllProducts(
    @Query() query: AdminViewProductsPaginationDto,
  ): Promise<
    ApiResponse<{
      items: Product[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search;

    const skip = (page - 1) * limit;
    const [items, total] = await this.productService.viewAllProducts({
      skip,
      take: limit,
      search,
    });

    const totalPages = Math.ceil(total / limit);
    return new ApiResponse(
      200,
      { items, meta: { total, page, limit, totalPages } },
      'Products retrieved',
    );
  }

  @Patch(':id')
  @FileUpload({
    fieldName: 'image',
    destination: './uploads',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateProductDto,
  ): Promise<ApiResponse<Product>> {
    const updateData: any = { ...dto };
    if (file) {
      updateData.image = `/uploads/${file.filename}`;
    }
    const updated = await this.productService.updateProduct(id, updateData);
    return new ApiResponse(200, updated, 'Product updated');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteProduct(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponse<Product>> {
    const deleted = await this.productService.deleteProduct(id);
    return new ApiResponse(200, deleted, 'Product deleted');
  }

  // ─── PUBLIC / CUSTOMER ─────────────────────────────
  @Get('popular')
  async getPopularProducts(
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<Product[]>> {
    const products = await this.productService.getPopularProducts(limit);
    return new ApiResponse(200, products, 'Popular products retrieved');
  }

  @Get('all')
  async getAllProducts(@Query() query: AdminViewProductsPaginationDto): Promise<
    ApiResponse<{
      items: Product[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search;

    const skip = (page - 1) * limit;
    const [items, total] = await this.productService.viewAllProducts({
      skip,
      take: limit,
      search,
    });

    const totalPages = Math.ceil(total / limit);
    return new ApiResponse(
      200,
      { items, meta: { total, page, limit, totalPages } },
      'Products retrieved',
    );
  }

  @Get('by-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async getUserProducts(@Req() req): Promise<ApiResponse<Product[]>> {
    const products = await this.productService.getUserProducts(req.user.id);
    console.log('Products: ', products);
    return new ApiResponse(200, products, 'User products retrieved');
  }

  @Get(':id')
  async viewProduct(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponse<Product>> {
    const product = await this.productService.viewProduct(id);
    return new ApiResponse(200, product, 'Product retrieved');
  }

  @Post(':id/buy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async buyProduct(
    @Param('id', ParseIntPipe) productId: number,
    @Req() req: any,
  ): Promise<ApiResponse<Sale>> {
    const sale = await this.productService.buyProduct(req.user.id, productId);
    return new ApiResponse<Sale>(200, sale, 'Product purchased');
  }
}
