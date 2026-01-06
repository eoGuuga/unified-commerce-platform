import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { WhatsappConversation } from './WhatsappConversation.entity';

@Entity('whatsapp_messages')
@Index(['conversation_id', 'sent_at'])
@Index(['conversation_id', 'direction', 'sent_at'])
export class WhatsappMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  conversation_id: string;

  @ManyToOne(() => WhatsappConversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: WhatsappConversation;

  @Column({ type: 'varchar', length: 20 })
  direction: 'inbound' | 'outbound';

  @Column('text')
  body: string;

  @Column({ type: 'varchar', length: 50, default: 'text' })
  message_type: 'text' | 'image' | 'document' | 'button';

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  sent_at: Date;

  @CreateDateColumn()
  created_at: Date;
}

