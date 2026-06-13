import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { User } from '@prisma/client';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('github.clientId') ?? 'missing-client-id',
      clientSecret:
        config.get<string>('github.clientSecret') ?? 'missing-client-secret',
      callbackURL: config.get<string>('github.callbackUrl') as string,
      scope: ['user:email'],
    });
  }

  /** Exchanges the GitHub profile for a DB user; return becomes `req.user`. */
  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<User> {
    const email =
      profile.emails?.[0]?.value ??
      `${profile.username ?? profile.id}@users.noreply.github.com`;

    return this.authService.validateGithubUser({
      githubId: profile.id,
      email,
      name: profile.displayName ?? profile.username ?? email,
      avatarUrl: profile.photos?.[0]?.value ?? null,
      accessToken,
    });
  }
}
