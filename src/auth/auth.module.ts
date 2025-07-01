import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy';
import { LevelService } from 'src/level/level.service';
import { LevelModule } from 'src/level/level.module';

@Module({
  imports: [JwtModule.register({}), LevelModule],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
