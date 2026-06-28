import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../../database/entities/Usuario.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Usuario])],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
