#include <stdio.h>
#include <dirent.h> 
#include <malloc.h>
#include <string.h>
#include <errno.h>
#include <stdlib.h>
#include <limits.h>

#define W 1280
#define H 720 
#define FPS 30 

#define IMAGE 0
#define VIDEO 1
#define GIF 2

typedef struct ENTRY_t {
	int media_type;
	int w;
        int h;
        int x;
        int y;
        char* path;
	int position;
        int duration;
	FILE *f;
	int finished;	
	struct ENTRY_t* next;
	unsigned char* frame;
} ENTRY;	

ENTRY* head;
ENTRY* next;

const int frame_size_v=W*H*4;

// ignore transparency
void piccpy0(unsigned char* src, int x, int y, int w, int h, unsigned char* dest) {
    for (int i=y;i<y+h;i++) {
        memcpy(dest+i*W*4+x*4,src+(i-y)*w*4,w*4);
    }
}

// use transparency
void mul(unsigned char* src, unsigned char* dest, int a) {
    int v = dest[0];
    int o = src[0];
    v=o*a+v*(255-a);
    v/=256;
    dest[0]=(unsigned char)v; 
}

void piccpy(unsigned char* src, int x, int y, int w, int h, unsigned char* dest) {
    unsigned int *sargb = (unsigned int*)src;
    unsigned int *dargb = (unsigned int*)dest;

    int sx=x; if (sx>W) { sx = W; };
    int ex=x+w; if (ex>W) { ex = W; };
    int sy=y; if (sy>H) { sy = H; };
    int ey=y+h; if (ey>H) { ey = H; };

    for (int i=sy;i<ey;i++) {
        for (int j=sx;j<ey;j++) {
            // full opacity?
            if ((sargb[(i-y)*w+(j-x)] & 0xFF) == 0xFF) {
                dargb[i*W+j]=sargb[(i-y)*w+(j-x)];
            } else {
                // not full opacity but not full transparency either?
                if ((sargb[(i-y)*w+(j-x)] & 0xFF) >0) {
                    // overlay
                    int a=src[(i-y)*w*4+(j-x)*4] & 0xFF;
                    dest[i*W*4+j*4]=255;
 	            mul(src+(i-y)*w*4+(j-x)*4+1, dest+i*W*4+j*4+1, a);
                    mul(src+(i-y)*w*4+(j-x)*4+2, dest+i*W*4+j*4+2, a);
                    mul(src+(i-y)*w*4+(j-x)*4+3, dest+i*W*4+j*4+3, a);
                }
            }
        }
    }
}

// params:
// 0 1080 520 100 100 /tmp/file.png 0 100
// image width height x y path start_frame duration_frames

int main (int argc, char** argv) {
    int files=(argc-1)/8;
    fprintf(stderr, "argc %d, number of entries %d\n", argc, files);
    next = NULL;
    for (int i=0;i<files;i++) {
        if (next) {
            next->next = (ENTRY*)calloc(1, sizeof(ENTRY));
            next=next->next;
        } else {
            next=(ENTRY*)calloc(1, sizeof(ENTRY));
            head=next;
        }
	next->media_type=atoi(argv[i*8+1]);
        next->w=atoi(argv[i*8+2]);
        next->h=atoi(argv[i*8+3]);
        next->x=atoi(argv[i*8+4]);
        next->y=atoi(argv[i*8+5]);
        next->path=argv[i*8+6];
        next->position=atoi(argv[i*8+7]);
        next->duration=atoi(argv[i*8+8]);
        // will terminate when the stream ends
        if (next->duration==0) {
          next->duration=INT_MAX;
        }
    }
    next=head;
    while (next) {
        fprintf(stderr, "media: %d, path: %s, w: %d, h: %d, x: %d, y:%d, position: %d, duration: %d\n",
            next->media_type,
            next->path,
            next->w,
            next->h,
            next->x,
            next->y,
            next->position,
            next->duration);
        next=next->next;
    }
    next=head;

    int frame=0;
    int unfinished=0;
    int latest_position;
    unsigned char* output=(unsigned char*)calloc(1,frame_size_v);
    fprintf(stderr, "processing\n");
    do {
        next=head;
        // get next frame and apply it
        unfinished=0;
        latest_position=0;
        memset(output, 0, frame_size_v);
        while (next) {
            if (next->position == frame) {
                fprintf(stderr, "opening %s at %d\n", next->path, frame);
                next->f=fopen(next->path, "r");
                if (!next->f) {
                    fprintf(stderr,"error %d when opening file %s\n", errno, next->path);
                    return 1;
                } else {
                    fprintf(stderr, "opened successfully\n");
                }
                next->frame=(unsigned char*)calloc(1,next->w*next->h*4);
                // image is to be read once, applied all the time
                if (next->media_type==IMAGE) {
                   int nbytes = next->w*next->h*4;                   
                   int c = fread(next->frame, nbytes, 1, next->f);
                   if (c != 1) {
                       fprintf(stderr, "error reading, c=%d\n", c);
                       fclose(next->f);
                       next->finished=1;
                       free(next->frame);
                   }
                }
            }
            if (!next->finished && (next->position+next->duration)<=frame) {
                next->finished=1;
            }
            if (!next->finished && next->position<=frame && (next->position+next->duration)>frame) {
                if (next->media_type==VIDEO) {
                   int nbytes = next->w*next->h*4;
                   int c = fread(next->frame, nbytes, 1, next->f); 
                   if (c != 1) {
                       fprintf(stderr, "error reading, c=%d\n", c);
                       fclose(next->f);
                       next->finished=1;
                       free(next->frame);
                   }
                }
                if (!next->finished) {
                    piccpy(next->frame, next->x, next->y, next->w, next->h, output);
                }
            }
            if (!next->finished) { unfinished++; }
            next=next->next;
        }
        fwrite(output, frame_size_v, 1, stdout);
        frame++;
    }
    while (unfinished);
    fprintf(stderr,"done processing.\n");
    free(output);
    return 0;
}
