import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy';
import { LevelService } from 'src/level/level.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthService, JwtStrategy,LevelService],
  controllers: [AuthController],
})
export class AuthModule {}
