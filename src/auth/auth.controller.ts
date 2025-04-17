import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto, SendEmailDto, SignupDto } from './dto';
import { ApiResponse } from 'src/common';

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
    const user = await this.authService.signup(dto);

    return new ApiResponse(200, null, 'User Created Successfully');
  }

  @Post('signin')
  async signin(@Body() dto: AuthDto) {
    return this.authService.signin(dto);
  }
}
