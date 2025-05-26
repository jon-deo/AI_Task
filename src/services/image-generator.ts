import sharp from 'sharp';
import type { Celebrity } from '@/types';

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
}

export class ImageGenerator {
  /**
   * Generate placeholder images for a celebrity
   */
  static async generateCelebrityImages(
    celebrity: Celebrity,
    count: number = 3,
    options: ImageGenerationOptions = {}
  ): Promise<Buffer[]> {
    const {
      width = 1920,
      height = 1080,
      quality = 90,
      format = 'jpeg',
      backgroundColor = '#1a1a1a',
      textColor = '#ffffff',
      fontSize = 72,
    } = options;

    const images: Buffer[] = [];

    for (let i = 0; i < count; i++) {
      const image = await this.createCelebrityImage({
        celebrity,
        width,
        height,
        quality,
        format,
        backgroundColor: this.getBackgroundColor(i, backgroundColor),
        textColor,
        fontSize,
        imageIndex: i,
      });
      images.push(image);
    }

    return images;
  }

  /**
   * Create a single celebrity image
   */
  private static async createCelebrityImage(params: {
    celebrity: Celebrity;
    width: number;
    height: number;
    quality: number;
    format: 'jpeg' | 'png' | 'webp';
    backgroundColor: string;
    textColor: string;
    fontSize: number;
    imageIndex: number;
  }): Promise<Buffer> {
    const {
      celebrity,
      width,
      height,
      quality,
      format,
      backgroundColor,
      textColor,
      fontSize,
      imageIndex,
    } = params;

    // Create gradient background
    const gradientSvg = this.createGradientBackground(
      width,
      height,
      backgroundColor,
      imageIndex
    );

    // Create text overlay
    const textSvg = this.createTextOverlay(
      celebrity,
      width,
      height,
      textColor,
      fontSize,
      imageIndex
    );

    // Combine background and text
    const combinedSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${gradientSvg}
        ${textSvg}
      </svg>
    `;

    // Convert SVG to image buffer
    let sharpInstance = sharp(Buffer.from(combinedSvg));

    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
    }

    return sharpInstance.toBuffer();
  }

  /**
   * Create gradient background SVG
   */
  private static createGradientBackground(
    width: number,
    height: number,
    baseColor: string,
    index: number
  ): string {
    const gradients = [
      // Sports-themed gradients
      `<defs>
        <linearGradient id="grad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e3c72;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2a5298;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad${index})" />`,
      
      `<defs>
        <linearGradient id="grad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#134e5e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#71b280;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad${index})" />`,
      
      `<defs>
        <linearGradient id="grad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667db6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0082c8;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad${index})" />`,
    ];

    return gradients[index % gradients.length];
  }

  /**
   * Create text overlay SVG
   */
  private static createTextOverlay(
    celebrity: Celebrity,
    width: number,
    height: number,
    textColor: string,
    fontSize: number,
    index: number
  ): string {
    const centerX = width / 2;
    const centerY = height / 2;

    const texts = [
      celebrity.name,
      `${celebrity.name}\n${celebrity.sport}`,
      `${celebrity.name}\nLegend`,
    ];

    const text = texts[index % texts.length];
    const lines = text.split('\n');

    let textElements = '';
    lines.forEach((line, lineIndex) => {
      const y = centerY + (lineIndex - (lines.length - 1) / 2) * (fontSize * 1.2);
      textElements += `
        <text x="${centerX}" y="${y}" 
              font-family="Arial, sans-serif" 
              font-size="${fontSize}" 
              font-weight="bold" 
              fill="${textColor}" 
              text-anchor="middle" 
              dominant-baseline="middle"
              stroke="#000000" 
              stroke-width="2">
          ${line}
        </text>
      `;
    });

    return textElements;
  }

  /**
   * Get background color variation
   */
  private static getBackgroundColor(index: number, baseColor: string): string {
    // Return different shades for variety
    const colors = [
      '#1a1a1a', // Dark gray
      '#2d1b69', // Dark purple
      '#1e3c72', // Dark blue
    ];
    
    return colors[index % colors.length] || baseColor;
  }

  /**
   * Generate sports-themed background patterns
   */
  static async generateSportsBackground(
    sport: string,
    width: number = 1920,
    height: number = 1080
  ): Promise<Buffer> {
    const patterns = {
      BASKETBALL: this.createBasketballPattern(width, height),
      FOOTBALL: this.createFootballPattern(width, height),
      SOCCER: this.createSoccerPattern(width, height),
      TENNIS: this.createTennisPattern(width, height),
      BASEBALL: this.createBaseballPattern(width, height),
      default: this.createGenericSportsPattern(width, height),
    };

    const pattern = patterns[sport as keyof typeof patterns] || patterns.default;
    
    return sharp(Buffer.from(pattern))
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * Create basketball-themed pattern
   */
  private static createBasketballPattern(width: number, height: number): string {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="basketballGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ff6b35;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f7931e;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#basketballGrad)" />
        <circle cx="${width * 0.2}" cy="${height * 0.3}" r="50" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.3" />
        <circle cx="${width * 0.8}" cy="${height * 0.7}" r="30" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.2" />
      </svg>
    `;
  }

  /**
   * Create football-themed pattern
   */
  private static createFootballPattern(width: number, height: number): string {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="footballGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#2d5016;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3e6b1f;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#footballGrad)" />
        <line x1="0" y1="${height * 0.2}" x2="${width}" y2="${height * 0.2}" stroke="#ffffff" stroke-width="2" opacity="0.3" />
        <line x1="0" y1="${height * 0.8}" x2="${width}" y2="${height * 0.8}" stroke="#ffffff" stroke-width="2" opacity="0.3" />
      </svg>
    `;
  }

  /**
   * Create soccer-themed pattern
   */
  private static createSoccerPattern(width: number, height: number): string {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="soccerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e5799;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#2989d8;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#soccerGrad)" />
        <circle cx="${width * 0.5}" cy="${height * 0.5}" r="80" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.3" />
      </svg>
    `;
  }

  /**
   * Create tennis-themed pattern
   */
  private static createTennisPattern(width: number, height: number): string {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tennisGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8360c3;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#2ebf91;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#tennisGrad)" />
        <line x1="0" y1="${height * 0.5}" x2="${width}" y2="${height * 0.5}" stroke="#ffffff" stroke-width="2" opacity="0.3" />
      </svg>
    `;
  }

  /**
   * Create baseball-themed pattern
   */
  private static createBaseballPattern(width: number, height: number): string {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="baseballGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#c31432;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#240b36;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#baseballGrad)" />
        <path d="M ${width * 0.2} ${height * 0.3} Q ${width * 0.5} ${height * 0.1} ${width * 0.8} ${height * 0.3}" 
              fill="none" stroke="#ffffff" stroke-width="2" opacity="0.3" />
      </svg>
    `;
  }

  /**
   * Create generic sports pattern
   */
  private static createGenericSportsPattern(width: number, height: number): string {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="genericGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667db6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0082c8;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#genericGrad)" />
      </svg>
    `;
  }
}
