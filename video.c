#include <stdio.h>
#include <dirent.h> 
#include <malloc.h>
#include <string.h>
#include <errno.h>
#include <stdlib.h>

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

void piccpy(unsigned char* src, int x, int y, int w, int h, unsigned char* dest) {
    for (int i=y;i<y+h;i++) {
      memcpy(dest+i*W*4+x*4,src+i*w*4,w*4);
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
	next->media_type=IMAGE;
        next->w=atoi(argv[i*8+2]);
        next->h=atoi(argv[i*8+3]);
        next->x=atoi(argv[i*8+4]);
        next->y=atoi(argv[i*8+5]);
        next->path=argv[i*8+6];
        next->position=atoi(argv[i*8+7]);
        next->duration=atoi(argv[i*8+8]);
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
        fprintf(stderr, "%d\n", frame);
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
                // image is to be read once, applied all the time
                if (next->media_type==IMAGE) {
                    next->frame=(unsigned char*)calloc(1,next->w*next->h*4);
                    int c = fread(next->frame, next->w*next->h*4, 1, next->f);
                }
            }
            if (!next->finished && (next->position+next->duration)<=frame) {
                next->finished=1;
            }
            if (!next->finished && next->position<=frame && (next->position+next->duration)>frame) {
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
