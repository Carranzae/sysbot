import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

const TRIGGER_TYPES = ['keywords', 'exact', 'regex', 'KEYWORDS', 'EXACT', 'REGEX'] as const
const RULE_SCOPES = ['channel', 'all', 'CHANNEL', 'ALL'] as const
const RULE_ENGINES = ['manual', 'rag', 'MANUAL', 'RAG'] as const

class MediaMapDto {
  @IsOptional()
  @IsString()
  image?: string | null

  @IsOptional()
  @IsString()
  pdf?: string | null

  @IsOptional()
  @IsString()
  audio?: string | null

  @IsOptional()
  @IsString()
  video?: string | null
}

export class CreateBotRuleDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsString()
  @IsIn(TRIGGER_TYPES as readonly string[])
  triggerType!: string

  @IsOptional()
  @IsString()
  triggerValue?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[]

  @IsString()
  @IsNotEmpty()
  responseText!: string

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaMapDto)
  mediaByType?: MediaMapDto

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[]

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  channels?: string[]

  @IsString()
  @IsIn(RULE_SCOPES as readonly string[])
  scope!: string

  @IsString()
  @IsIn(RULE_ENGINES as readonly string[])
  engine!: string

  @IsOptional()
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsInt()
  priority?: number

  @IsOptional()
  metadata?: Record<string, any>
}

export class UpdateBotRuleDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsString()
  @IsIn(TRIGGER_TYPES as readonly string[])
  triggerType?: string

  @IsOptional()
  @IsString()
  triggerValue?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[]

  @IsOptional()
  @IsString()
  responseText?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaMapDto)
  mediaByType?: MediaMapDto

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[]

  @IsOptional()
  @IsString()
  @IsIn(RULE_SCOPES as readonly string[])
  scope?: string

  @IsOptional()
  @IsString()
  @IsIn(RULE_ENGINES as readonly string[])
  engine?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsInt()
  priority?: number

  @IsOptional()
  metadata?: Record<string, any>
}
