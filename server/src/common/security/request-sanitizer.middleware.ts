import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class RequestSanitizerMiddleware implements NestMiddleware {
  private readonly sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard' as sanitizeHtml.DisallowedTagsModes,
    textFilter: (text) => {
      // Remove any remaining HTML entities
      return text.replace(/&[^;]+;/g, '');
    },
  };

  use(req: Request, res: Response, next: NextFunction) {
    if (req.body) {
      this.sanitizeObject(req.body);
    }

    if (req.query) {
      this.sanitizeObject(req.query);
    }

    if (req.params) {
      this.sanitizeObject(req.params);
    }

    next();
  }

  private sanitizeObject(obj: any) {
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === 'string') {
        obj[key] = this.sanitizeInput(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key]);
      }
    });
  }

  private sanitizeInput(input: string): string {
    const sanitized = sanitizeHtml(input, this.sanitizeOptions);
    return sanitized
      .replace(/&[^;]+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
