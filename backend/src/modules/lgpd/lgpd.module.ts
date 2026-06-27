import { Module } from '@nestjs/common';
import { LgpdController } from './lgpd.controller';
import { LgpdService } from './lgpd.service';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [LgpdController],
  providers: [LgpdService],
  exports: [LgpdService],
})
export class LgpdModule {}
