<template>
  <div>
    <input type="text" class="form-control" placeholder="Search for a video or enter a YouTube Video URL..." v-model="searchTerm" v-if="!videoId" />
    <div class="overlay" v-if="videoId">
      <div class="drag"></div>
      <div class="videoInfo">
        <p>Title</p>
      </div>

      <div class="controls">
        <i class="fal fa-play" @click="play()" v-if="!playing"></i>
        <i class="fal fa-pause" @click="pause()" v-else></i>
      </div>

      <div class="videoTimeBar">
        <p>Bar</p>
      </div>
    </div>
    <div id="player"></div>
  </div>
</template>

<script>
  const electron = require('electron');
  const axios = require('axios');
  const remote = electron.remote;
  const Menu = remote.Menu;
  import {ipcRenderer} from 'electron'


  export default {
    beforeMount() {
      ipcRenderer.on('PlayPause', (event, arg) => {
        var state = this.player.getPlayerState();
        if(state === 1) {
          this.player.pauseVideo();
        } else if (state === 2) {
          this.player.playVideo();
        }
      })
      ipcRenderer.on('Next', (event, arg) => {
        this.nextVideoInPlaylist(true);
      })
      ipcRenderer.on('Previous', (event, arg) => {
        this.previousVideoInPlaylist(true);
      })
      const InputMenu = Menu.buildFromTemplate([{
        label: 'Undo',
        role: 'undo',
      }, {
        label: 'Redo',
        role: 'redo',
      }, {
        type: 'separator',
      }, {
        label: 'Cut',
        role: 'cut',
      }, {
        label: 'Copy',
        role: 'copy',
      }, {
        label: 'Paste',
        role: 'paste',
      }, {
        type: 'separator',
      }, {
        label: 'Select all',
        role: 'selectall',
      },
      ]);

      document.body.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();

        let node = e.target;

        while (node) {
          if (node.nodeName.match(/^(input|textarea)$/i) || node.isContentEditable) {
            InputMenu.popup(remote.getCurrentWindow());
            break;
          }
          node = node.parentNode;
        }
      });

      let tag = document.createElement('script');
      tag.src = "//www.youtube.com/iframe_api";

      document.body.append(tag);
    },

    data() {
      return {
        playing: false,
        player: false,
        videoId: false,
        playlist: [],
        playlistIndex: 0,
        searchTerm: "",
        stayOnTop: false,
      }
    },

    methods: {
      stopVideo () {
        this.player.stopVideo();

      },

      onPlayerStateChange (event) {
        if (event.data === 0) {
          this.playing = false;
          if (this.playlist.length) {
            this.videoId = this.nextVideoInPlaylist();
          }
        } else if (event.data === 1) {
          this.playing = true;
        } else if (event.data === 2) {
          this.playing = false;
        }
      },

      nextVideoInPlaylist(play = false) {
        this.playlistIndex++;
        const videoId = this.playlist[this.playlistIndex].snippet.resourceId.videoId;

        if (play) {
          this.videoId = videoId;
        } else {
          return videoId;
        }
      },

      play() {
        this.playing = true;
        this.player.playVideo();
      },

      pause() {
        this.playing = false;
        this.player.pauseVideo();
      },

      previousVideoInPlaylist(play = false) {
        if (this.videoIndex === 0) {
          this.videoIndex = this.playlist.length - 1;
        } else {
          this.playlistIndex--;
        }

        const videoId = this.playlist[this.playlistIndex].snippet.resourceId.videoId;

        if (play) {
          this.videoId = videoId;
        } else {
          return videoId;
        }
      },

      onPlayerReady (event) {
        event.target.playVideo();
        require('electron').remote.getCurrentWindow().setSize(350, 200);
      },

      loadVideoByUrl(url) {
        //https://www.youtube.com/watch?v=PnNlcSY06gk
        this.videoId = /(youtu\.be\/|youtube\.com\/(watch\?(.*&)?v=|(embed|v)\/))([^\?&"'>]+)/.exec(url)[5];

        this.loadPlaylistFromUrl(url);
      },

      loadPlaylistFromUrl(url) {
        let listId = false;

        if (listId = this.getParameterByName('list', url)) {
          const url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&key=AIzaSyBEcii_9pdOel4k13Pha-78zoNTW_EvYFU&maxResults=50&playlistId=" + listId;

          axios.get(url).then((r) => {
            this.playlist = r.data.items;
          });
        }
      },

      setVideoId(id) {
        this.videoId = id;
      },

      getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
          results = regex.exec(url);
        if (!results) return false;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
      },

      search(term) {
        //TODO: Make a search
      },

      loadPlaylistFromSpotifyUri(term) {
        //TODO: Get playlist from Spotify API and query YouTube async and append to playlist
      },

      loadTrackFromSpotifyUri(term) {
        //TODO: Get track (artist-trackName) from Spotify and query YouTube
      }
    },

    watch: {
      searchTerm (newTerm) {
        if (/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.)?youtube\.com\/watch(?:\.php)?\?.*v=)([a-zA-Z0-9\-_]+)/.test(newTerm)) {
          this.loadVideoByUrl(newTerm);
        } else if (/spotify:playlist:([a-zA-Z0-9]{22})/.test(newTerm)) {
          this.loadPlaylistFromSpotifyUri(newTerm);
        } else {
          this.search(newTerm);
        }
      },

      videoId (newId) {
        if (newId) {
          document.querySelector('html').classList.add('has-video');

          if (!this.player) {
            this.player = new YT.Player('player', {
              height: '390',
              width: '640',
              videoId: newId,
              playerVars: {'controls': '0', 'showinfo': '0'},
              events: {
                'onReady': this.onPlayerReady,
                'onStateChange': this.onPlayerStateChange.bind(this)
              },
              host: 'https://www.youtube.com',
            });
          } else {
            console.log(newId);
            this.player.loadVideoById(newId);
          }
        }
      }
    }
  }
</script>

<style>
  * {
    overflow: hidden;
  }

  html, body {
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    opacity: 0;
    -webkit-transition: all 250ms;
    display: flex;
    flex-direction: column;
  }

  .videoInfo, .controls, .videoTimeBar {
    color: #fff;
    display: flex;
    justify-content: center;
  }

  .videoInfo {
    align-items: flex-start;
    -webkit-app-region: drag;
  }

  .controls {
    align-items: center;
  }

  .controls i {
    font-size: 2em;
  }

  .videoTimeBar {
    align-items: flex-end;
  }

  html.has-video, html.has-video body, html.has-video #app, html.has-video #app div, html.has-video #app iframe {
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
  }

  html.has-video #player {
    pointer-events: none;
  }

  .overlay:hover {
    opacity: 1;
  }
</style>