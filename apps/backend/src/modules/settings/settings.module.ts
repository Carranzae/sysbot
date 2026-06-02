import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { DatabaseModule } from '../database/database.module'
import { SettingsService } from './settings.service'

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
