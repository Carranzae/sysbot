import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { MetaModule } from '../meta/meta.module';
import { OauthController } from './oauth.controller';
import { MetaOauthService } from './meta-oauth.service';
import { GoogleOauthService } from './google-oauth.service';

@Module({
  imports: [ConfigModule, DatabaseModule, MetaModule],
  controllers: [OauthController],
  providers: [MetaOauthService, GoogleOauthService],
  exports: [MetaOauthService, GoogleOauthService],
})
export class OauthModule {}
