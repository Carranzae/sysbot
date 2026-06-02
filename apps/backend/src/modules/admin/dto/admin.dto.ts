import { IsEnum, IsArray, IsString, IsOptional, IsBoolean } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
    @IsEnum(UserRole)
    role: UserRole;
}

export class UpdateUserPermissionsDto {
    @IsArray()
    @IsString({ each: true })
    permissions: string[];
}

export class UpdateSystemConfigDto {
    @IsString()
    key: string;

    @IsString()
    value: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isEncrypted?: boolean;
}
