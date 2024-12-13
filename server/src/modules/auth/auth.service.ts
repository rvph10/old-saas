import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Region for Prisma queries
   */

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const defaultRole = await this.getDefaultRole();
    return this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        roleId: defaultRole.id,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      },
      include: {
        role: true,
      },
    });
  }

  async getDefaultRole() {
    const defaultRole = this.prisma.role.findFirst({
      where: {
        name: 'user',
      },
    });
    if (!defaultRole) {
      return this.prisma.role.create({
        data: {
          name: 'user',
          permissions: {
            create: {
              name: 'read',
            },
          }
        },
      });
    }
    return defaultRole;
  }

  async checkIfUserExists(data: {
    username?: string;
    email?: string;
    id?: string;
  }) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
          { id: data.id },
        ],
        deletedAt: null,
      },
    });
  }

  async getUser(data: { username?: string; email?: string; id?: string }) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
          { id: data.id },
        ],
        deletedAt: null,
      },
    });
  }

  /**
   * End region
   */

  /**
   * Region for Auth methods
   */
  async login(loginDto: LoginDto) {
    const user = await this.getUser({ username: loginDto.username });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.checkIfUserExists({
      email: registerDto.email,
      username: registerDto.username,
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.createUser({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    return this.generateToken(user);
  }

  private generateToken(user: any) {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
  /**
   * End region
   */
}
