import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private cloudName = 'dl8rbctpf';
  private uploadPreset = 'pv_tennis_profiles';

  /**
   * Upload image to Cloudinary
   * @param file Image file to upload
   * @returns Promise with secure URL of uploaded image
   */
  uploadImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.uploadPreset);

      fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.secure_url) {
            resolve(data.secure_url);
          } else {
            reject('Upload failed');
          }
        })
        .catch((error) => reject(error));
    });
  }

  /**
   * Validate image file
   * @param file File to validate
   * @returns Error message or null if valid
   */
  validateImage(file: File): string | null {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      return 'Only JPEG, PNG, GIF, and WebP images are allowed';
    }
    if (file.size > maxSize) {
      return 'Image size must be less than 5MB';
    }
    return null;
  }
}
