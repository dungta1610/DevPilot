import { UserDto } from '../../users/dto/user.dto';

/** Response shape for `GET /auth/me` — the authenticated user. */
export class AuthResponseDto extends UserDto {}

export interface JwtPayload {
  sub: string;
  email: string;
}
