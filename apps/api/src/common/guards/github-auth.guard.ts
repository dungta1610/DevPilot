import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Drives the passport-github2 OAuth handshake. */
@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {}
