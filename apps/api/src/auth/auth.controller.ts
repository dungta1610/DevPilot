import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GithubAuthGuard } from '../common/guards/github-auth.guard';
import { AuthResponseDto } from './dto/auth-response.dto';
import { toUserDto } from '../users/dto/user.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Step 1: redirect the browser to GitHub's consent screen. */
  @Public()
  @Get('github')
  @UseGuards(GithubAuthGuard)
  githubLogin(): void {
    // The guard handles the redirect to GitHub.
  }

  /** Step 2: GitHub redirects back here; issue a JWT and bounce to the frontend. */
  @Public()
  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  githubCallback(
    @CurrentUser() user: User,
    @Res() res: Response,
  ): void {
    const token = this.authService.signToken(user);
    const frontendUrl = this.config.get<string>('frontendUrl');
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }

  @Get('me')
  me(@CurrentUser() user: User): AuthResponseDto {
    return toUserDto(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(): { message: string } {
    // Stateless JWT: the client discards the token. Endpoint exists for symmetry.
    return { message: 'Logged out' };
  }
}
