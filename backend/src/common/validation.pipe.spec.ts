import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsInt, IsString } from 'class-validator';

class SampleDto {
  @IsString()
  name: string;

  @IsInt()
  age: number;
}

describe('Global ValidationPipe config (E-44)', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  const meta = { type: 'body' as const, metatype: SampleDto };

  it('rejects an unknown field', async () => {
    await expect(
      pipe.transform({ name: 'Alice', age: 30, sneaky: 'x' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects wrong types', async () => {
    await expect(
      pipe.transform({ name: 123, age: 'oops' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes a valid object through unchanged', async () => {
    const result = (await pipe.transform(
      { name: 'Alice', age: 30 },
      meta,
    )) as SampleDto;
    expect(result).toMatchObject({ name: 'Alice', age: 30 });
  });
});
