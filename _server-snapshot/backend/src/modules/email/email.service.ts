import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private resend: any;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const { Resend } = require('resend');
    this.resend = new Resend(this.configService.get('RESEND_API_KEY'));
    this.fromEmail = this.configService.get('EMAIL_FROM') || 'noreply@gtsofthub.com.br';
  }

  async sendConfirmationCode(email: string, code: string, fullName?: string) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Codigo de confirmacao - GTSoftHub',
        html: '<h2>Ola' + (fullName ? ' ' + fullName : '') + '!</h2><p>Seu codigo de confirmacao e:</p><h1 style="letter-spacing:8px">' + code + '</h1><p>Este codigo expira em 15 minutos.</p>',
      });
      if (error) { console.error('Erro ao enviar email:', error); return false; }
      console.log('Email enviado:', data?.id);
      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, fullName?: string) {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Bem-vindo ao GTSoftHub!',
        html: '<h2>Bem-vindo ao GTSoftHub!</h2><p>Sua conta foi confirmada!</p><a href="https://gtsofthub.com.br">Acessar plataforma</a>',
      });
      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      return false;
    }
  }
}
