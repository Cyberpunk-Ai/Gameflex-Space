import { supabase } from '@/integrations/supabase/client';

export interface IStorageProvider {
  upload(bucket: string, path: string, file: File, options?: any): Promise<{ url: string; path: string; error?: string }>;
  delete(bucket: string, path: string): Promise<{ error?: string }>;
  getPublicUrl(bucket: string, path: string): string;
  update(bucket: string, oldPath: string, newPath: string, file: File, options?: any): Promise<{ url: string; error?: string }>;
}

export class SupabaseStorageProvider implements IStorageProvider {
  async upload(bucket: string, path: string, file: File, options?: any): Promise<{ url: string; path: string; error?: string }> {
    try {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, options);
      if (error) throw error;
      const url = this.getPublicUrl(bucket, data.path);
      return { url, path: data.path };
    } catch (err: any) {
      return { url: '', path: '', error: err.message || String(err) };
    }
  }

  async delete(bucket: string, path: string): Promise<{ error?: string }> {
    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw error;
      return {};
    } catch (err: any) {
      return { error: err.message || String(err) };
    }
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async update(bucket: string, oldPath: string, newPath: string, file: File, options?: any): Promise<{ url: string; error?: string }> {
    try {
      if (oldPath !== newPath) {
        await this.delete(bucket, oldPath);
      }
      const { url, error } = await this.upload(bucket, newPath, file, { ...options, upsert: true });
      if (error) throw new Error(error);
      return { url };
    } catch (err: any) {
      return { url: '', error: err.message || String(err) };
    }
  }
}

export class MediaService {
  private provider: IStorageProvider;

  constructor(provider: IStorageProvider) {
    this.provider = provider;
  }

  setProvider(provider: IStorageProvider) {
    this.provider = provider;
  }

  async upload(bucket: string, path: string, file: File, options?: any): Promise<{ url: string; path: string; error?: string }> {
    return this.provider.upload(bucket, path, file, options);
  }

  async delete(bucket: string, path: string): Promise<{ error?: string }> {
    return this.provider.delete(bucket, path);
  }

  async update(bucket: string, oldPath: string, newPath: string, file: File): Promise<{ url: string; error?: string }> {
    return this.provider.update(bucket, oldPath, newPath, file, { upsert: true });
  }

  getPublicUrl(bucket: string, path: string): string {
    return this.provider.getPublicUrl(bucket, path);
  }

  async compress(file: File, maxSizeMB: number = 2): Promise<File> {
    // Basic stub for compression, in a real scenario you'd use a library like browser-image-compression
    return new Promise((resolve) => resolve(file));
  }

  async generateThumbnail(file: File, size: number = 256): Promise<File> {
    // Basic stub for thumbnail generation
    return new Promise((resolve) => resolve(file));
  }
}

export const mediaService = new MediaService(new SupabaseStorageProvider());
