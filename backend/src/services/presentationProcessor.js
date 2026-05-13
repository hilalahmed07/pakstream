const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const execAsync = promisify(exec);

class PresentationProcessor {
  constructor() {
    this.processedDir = path.join(__dirname, '../../uploads/presentations/processed');
  }

  async processPresentation(presentationId, originalPath) {
    try {
      console.log(`Processing presentation ${presentationId} from ${originalPath}`);
      
      // Verify input file exists
      if (!fsSync.existsSync(originalPath)) {
        throw new Error(`Input file not found: ${originalPath}`);
      }

      // Create presentation-specific directory
      const presentationDir = path.join(this.processedDir, presentationId);
      await fs.mkdir(presentationDir, { recursive: true });
      console.log(`Created presentation directory: ${presentationDir}`);

      // Convert to PNG images (one per slide)
      const slides = await this.convertToPNG(originalPath, presentationDir);
      
      // Generate thumbnail from first slide
      const thumbnailPath = await this.generateThumbnail(slides[0], presentationDir);

      console.log(`Presentation processing completed successfully. ${slides.length} slides processed.`);

      return {
        slides: slides.map((slide, index) => ({
          slideNumber: index + 1,
          imagePath: `presentations/processed/${presentationId}/${slide}`,
          thumbnailPath: index === 0 ? thumbnailPath : `presentations/processed/${presentationId}/${slide}`,
          type: 'image'
        })),
        thumbnail: thumbnailPath,
        totalSlides: slides.length
      };

    } catch (error) {
      console.error('Error processing presentation:', error);
      throw error;
    }
  }

  async convertToPNG(inputPath, outputDir) {
    try {
      // Strategy: Convert PPTX to PDF first, then PDF to PNG for better multi-slide support
      const baseFilename = path.basename(inputPath, path.extname(inputPath));
      const pdfPath = path.join(outputDir, `${baseFilename}.pdf`);
      
      // Step 1: Convert PPTX to PDF
      console.log('Step 1: Converting PPTX to PDF...');
      const pdfCommand = `soffice --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;
      console.log(`Executing: ${pdfCommand}`);
      
      const { stdout: pdfStdout, stderr: pdfStderr } = await execAsync(pdfCommand, { 
        timeout: 120000,
        cwd: process.cwd()
      });

      console.log('PDF conversion stdout:', pdfStdout);
      if (pdfStderr) {
        console.log('PDF conversion stderr:', pdfStderr);
      }

      // Wait for file system sync
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify PDF was created
      if (!fsSync.existsSync(pdfPath)) {
        throw new Error('PDF conversion failed - output file not found');
      }

      console.log('PDF created successfully:', pdfPath);

      // Step 2: Convert PDF to PNG (one image per page)
      console.log('Step 2: Converting PDF to PNG slides...');
      
      // Try ImageMagick first (best quality)
      try {
        const magickCommand = `convert -density 150 "${pdfPath}" "${outputDir}/slide-%03d.png"`;
        console.log(`Executing ImageMagick: ${magickCommand}`);
        
        await execAsync(magickCommand, { timeout: 120000 });
        
        // Wait for file system sync
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check PNG files created
        const files = await fs.readdir(outputDir);
        const pngFiles = files.filter(file => file.endsWith('.png') && file.startsWith('slide-'));
        
        if (pngFiles.length > 0) {
          console.log(`ImageMagick created ${pngFiles.length} slides`);
          
          // Clean up PDF
          await fs.unlink(pdfPath);
          
          // Sort by slide number
          const sortedFiles = pngFiles.sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numA - numB;
          });
          
          return sortedFiles;
        }
      } catch (magickError) {
        console.log('ImageMagick failed, trying Poppler pdftoppm:', magickError.message);
        
        // Fallback to Poppler (pdftoppm)
        try {
          const popplerCommand = `pdftoppm -png -r 150 "${pdfPath}" "${outputDir}/slide"`;
          console.log(`Executing Poppler: ${popplerCommand}`);
          
          await execAsync(popplerCommand, { timeout: 120000 });
          
          // Wait for file system sync
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check PNG files created
          const files = await fs.readdir(outputDir);
          const pngFiles = files.filter(file => file.endsWith('.png') && file.startsWith('slide'));
          
          if (pngFiles.length > 0) {
            console.log(`Poppler created ${pngFiles.length} slides`);
            
            // Clean up PDF
            await fs.unlink(pdfPath);
            
            // Sort by slide number
            const sortedFiles = pngFiles.sort((a, b) => {
              const numA = parseInt(a.match(/\d+/)?.[0] || '0');
              const numB = parseInt(b.match(/\d+/)?.[0] || '0');
              return numA - numB;
            });
            
            return sortedFiles;
          }
        } catch (popplerError) {
          console.log('Poppler failed:', popplerError.message);
        }
      }

      // Final fallback: use LibreOffice PNG conversion
      console.log('Fallback: Using LibreOffice PNG conversion...');
      const pngCommand = `soffice --headless --convert-to png --outdir "${outputDir}" "${pdfPath}"`;
      await execAsync(pngCommand, { timeout: 120000 });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const files = await fs.readdir(outputDir);
      const pngFiles = files.filter(file => file.endsWith('.png') && !file.startsWith('slide'));
      
      if (pngFiles.length > 0) {
        console.log(`LibreOffice created ${pngFiles.length} slides`);
        
        // Clean up PDF
        await fs.unlink(pdfPath);
        
        return pngFiles;
      }

      throw new Error('Failed to generate PNG slides from PDF');

    } catch (error) {
      console.error('PNG conversion error:', error);
      throw new Error(`Failed to convert presentation to PNG slides: ${error.message}`);
    }
  }

  async generateThumbnail(firstSlide, outputDir) {
    try {
      const thumbnailPath = path.join(outputDir, 'thumbnail.jpg');
      const firstSlidePath = path.join(outputDir, firstSlide);
      
      // Use ImageMagick to convert first PNG to optimized thumbnail
      if (fsSync.existsSync(firstSlidePath)) {
        try {
          await execAsync(`convert "${firstSlidePath}" -resize 320x240 -quality 85 "${thumbnailPath}"`, {
            timeout: 10000
          });
          console.log(`Thumbnail generated: ${thumbnailPath}`);
          return `presentations/processed/${path.basename(outputDir)}/thumbnail.jpg`;
        } catch (convertError) {
          console.log('ImageMagick not available, copying PNG as thumbnail.jpg');
          // If ImageMagick is not available, copy the PNG to thumbnail.jpg
          await fs.copyFile(firstSlidePath, thumbnailPath);
          console.log(`Thumbnail copied: ${thumbnailPath}`);
          return `presentations/processed/${path.basename(outputDir)}/thumbnail.jpg`;
        }
      }
      
      return `presentations/processed/${path.basename(outputDir)}/${firstSlide}`;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      // Don't fail the entire process if thumbnail generation fails
      return `presentations/processed/${path.basename(outputDir)}/${firstSlide}`;
    }
  }

  async cleanupTempFiles(filePath) {
    try {
      if (fsSync.existsSync(filePath)) {
        await fs.unlink(filePath);
        console.log(`Cleaned up temp file: ${filePath}`);
      }
    } catch (error) {
      console.error('Error cleaning up temp file:', error);
    }
  }
}

module.exports = PresentationProcessor;
