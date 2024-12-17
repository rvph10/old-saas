import { RequestSanitizerMiddleware } from './request-sanitizer.middleware';
import { Request, Response } from 'express';

describe('RequestSanitizerMiddleware', () => {
  let middleware: RequestSanitizerMiddleware;

  beforeEach(() => {
    middleware = new RequestSanitizerMiddleware();
  });

  it('should sanitize body data', () => {
    const req = {
      body: {
        text: '<script>alert("xss")</script>Hello',
        nested: {
          text: '<img src="x" onerror="alert(1)">World',
        },
      },
    } as Request;

    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.body.text).toBe('Hello');
    expect(req.body.nested.text).toBe('World');
    expect(next).toHaveBeenCalled();
  });

  it('should handle non-string values', () => {
    const req = {
      body: {
        number: 123,
        boolean: true,
        null: null,
        undefined: undefined,
      },
    } as Request;

    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.body).toEqual({
      number: 123,
      boolean: true,
      null: null,
      undefined: undefined,
    });
    expect(next).toHaveBeenCalled();
  });

  it('should handle complex HTML payloads', () => {
    const req = {
      body: {
        text: `<div class="dangerous">
          <script>alert('xss')</script>
          <p onclick="evil()">Hello</p>
          <iframe src="evil.com"></iframe>
          World
        </div>`,
      },
    } as Request;

    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.body.text.trim()).toBe('Hello World');
    expect(next).toHaveBeenCalled();
  });

  it('should preserve safe strings', () => {
    const req = {
      body: {
        text: 'This is a safe string without any HTML',
      },
    } as Request;

    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.body.text).toBe('This is a safe string without any HTML');
    expect(next).toHaveBeenCalled();
  });
});
