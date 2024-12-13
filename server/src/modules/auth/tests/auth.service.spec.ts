import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "../auth.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

describe("AuthService", () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe("register", () => {
    const registerDto = {
      email: "test@example.com",
      username: "testuser",
      password: "password123",
      firstName: "Test",
      lastName: "User",
    };

    it("should register a new user successfully", async () => {
      const hashedPassword = "hashedPassword";
      jest.spyOn(bcrypt, "hash").mockResolvedValue(hashedPassword as never);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...registerDto,
        id: "1",
        password: hashedPassword,
      });
      mockJwtService.sign.mockReturnValue("jwt_token");

      const result = await service.register(registerDto);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("user");
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          ...registerDto,
          password: hashedPassword,
        },
      });
    });

    it("should throw ConflictException if user already exists", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: "1" });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("login", () => {
    const loginDto = {
      username: "testuser",
      password: "password123",
    };

    it("should login successfully with correct credentials", async () => {
      const user = {
        id: "1",
        username: loginDto.username,
        password: "hashedPassword",
        email: "test@example.com",
      };

      mockPrismaService.user.findFirst.mockResolvedValue(user);
      jest.spyOn(bcrypt, "compare").mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue("jwt_token");

      const result = await service.login(loginDto);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("user");
    });

    it("should throw UnauthorizedException with incorrect password", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        password: "hashedPassword",
      });
      jest.spyOn(bcrypt, "compare").mockResolvedValue(false as never);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user not found", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
