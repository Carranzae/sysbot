import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('subscription')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @Column({
    type: 'varchar',
    enum: ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE', 'ULTIMATE']
  })
  planType: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column('jsonb')
  features: string[];

  @Column('jsonb')
  limits: {
    businesses: number;
    messages: number;
    aiTokens: number;
    calls: number;
    callMinutes: number;
  };

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  @UpdateDateColumn()
  updatedAt: Date;
}
