import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { MetaModule } from '../meta/meta.module';
import { CRMModule } from '../crm/crm.module';
import { OmnichannelController } from './omnichannel.controller';
import { OmnichannelService } from './omnichannel.service';

@Module({
  imports: [
    DatabaseModule,
    EmailModule,
    forwardRef(() => WhatsappModule),
    forwardRef(() => MetaModule),
    CRMModule,
  ],
  controllers: [OmnichannelController],
  providers: [OmnichannelService],
  exports: [OmnichannelService],
})
export class OmnichannelModule {}
