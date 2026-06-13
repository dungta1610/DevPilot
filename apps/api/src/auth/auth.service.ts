import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import {
  GithubProfileInput,
  UsersService,
} from '../users/users.service';
import { JwtPayload } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** Upserts the user from their GitHub profile (first login or token refresh). */
  validateGithubUser(profile: GithubProfileInput): Promise<User> {
    return this.usersService.upsertFromGithub(profile);
  }

  /** Signs a JWT carrying the user id and email. */
  signToken(user: User): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }
}
