import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, SendEmailDto, SignupDto } from './dto';
import { ApiResponse, Roles } from 'src/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/changePasswordDto.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('send-email')
  async sendEmail(@Body() dto: SendEmailDto): Promise<ApiResponse<null>> {
    await this.authService.sendEmail(dto);

    return new ApiResponse(200, null, 'Verification email sent');
  }

  @Post('signup')
  async signup(@Body() dto: SignupDto): Promise<ApiResponse<null>> {
    await this.authService.signup(dto);

    return new ApiResponse(200, null, 'User Created Successfully');
  }

  @Post('signin')
  async signin(@Body() dto: LoginDto) {
    const user = await this.authService.signin(dto);

    return new ApiResponse(200, user, 'User Logged In Successfully');
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @Roles('USER', 'ADMIN')
  async getCurrentUser(@Req() request: any): Promise<ApiResponse> {
    const user = await this.authService.getCurrentUser(request.user.id);

    return new ApiResponse(200, user, 'User Fetched Successfully');
  }

  @Post('request-password-reset')
  async requestReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<ApiResponse<null>> {
    await this.authService.requestPasswordReset(dto);
    return new ApiResponse(200, null, 'Password reset code sent');
  }

  @Post('reset-password')
  async reset(@Body() dto: ResetPasswordDto): Promise<ApiResponse<null>> {
    await this.authService.resetPassword(dto);
    return new ApiResponse(200, null, 'Password has been reset');
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN', 'USER')
  async changePassword(
    @Req() req,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResponse<null>> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new ForbiddenException('New passwords do not match.');
    }

    const userId = req.user.id;
    await this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );

    return new ApiResponse(200, null, 'Password updated successfully');
  }
}
