<template>
  <div>
    <input type="text" class="form-control" placeholder="Search for a video or enter a YouTube Video URL..." v-model="searchTerm" v-if="!videoId" />
    <span class="drag">
      <i class="fal fa-ellipsis-v-alt"></i>
    </span>
    <div class="overlay" v-if="videoId">
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
      this.registerEvents();

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
        authFlow: false,
        tokens: {
          Spotify: false,
          YouTube: false,
        }
      }
    },

    methods: {
      registerEvents() {
        ipcRenderer.on('PlayPause', (event, arg) => {
          let state = this.player.getPlayerState();

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

        ipcRenderer.on('SpotifyAuthComplete', (event, url) => {
          this.checkUrlForTokens(url);

          this.authYouTube();
        })

        ipcRenderer.on('YouTubeAuthComplete', (event, url) => {
          this.checkUrlForTokens(url);

          this.loadPlaylistFromSpotifyUri();
        });
      },

      checkUrlForTokens(url) {
        if (url.includes('access_token')) {
          const contents = this.hashToJson(url);

          console.log(contents);

          if (contents.hasOwnProperty('state')) {
            switch (contents.state) {
              case 'spotify':
                this.tokens.Spotify = contents;
                break;
              case 'youtube':
                this.tokens.YouTube = contents;
                break;
              default:
                console.warn('Found a token but couldn\'t identify provider');
                break;
            }
          }
        }
      },

      hashToJson(url) {
        return JSON.parse('{"' + decodeURI(url.substring(url.indexOf('#')+1)).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}');
      },

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

        if (event.data === YT.PlayerState.BUFFERING) {
          event.target.setPlaybackQuality('highres');
        }
      },

      nextVideoInPlaylist(play = false) {
        this.playlistIndex++;
        const videoId = this.playlist[this.playlistIndex].id;

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

        const videoId = this.playlist[this.playlistIndex].id;

        if (play) {
          this.videoId = videoId;
        } else {
          return videoId;
        }
      },

      onPlayerReady (event) {
        event.target.playVideo();
        event.target.setPlaybackQuality('highres');
        require('electron').remote.getCurrentWindow().setSize(480, 270);
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
            this.playlist = r.data.items.map((item) => { return this.transformPlaylistItem(item); });
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

      processQueryItems() {
        if (this.queryItems.length) {
          let first = this.playlist.length === 0;
          let item = this.queryItems[0];

          let query = item.track.name + ' - ' + item.track.artists.map(function(artist) { return artist.name; }).join(', ');

          const url = "https://www.googleapis.com/youtube/v3/search?maxResults=1&key=AIzaSyBEcii_9pdOel4k13Pha-78zoNTW_EvYFU&maxResults=50&q=" + query + "&type=video&part=snippet";

          axios.get(url).then((r) => {
            this.queryItems.shift();
            this.playlist.push(this.transformSearchItem(r.data.items[0]));
            if (first) {
              this.videoId = this.playlist[0].id;
            }

            this.processQueryItems();
          });
        }
      },

      transformSearchItem(item) {
        return {
          id: item.id.videoId,
          snippet: item.snippet
        };
      },

      transformPlaylistItem(item) {
        return {
          id: item.snippet.resourceId.videoId,
          snippet: item.snippet
        };
      },

      loadPlaylistFromSpotifyUri() {
        console.log(this.spotifyUri);
        if (/user:(.*)(?=:p)/.test(this.spotifyUri)) {
          const user = /user:(.*)(?=:p)/.exec(this.spotifyUri)[0];
          const playlist = /spotify:.*playlist:(.*)/.exec(this.spotifyUri)[1];

          axios.get(`https://api.spotify.com/v1/users/${user}/playlists/${playlist}/tracks`, {
            headers: {
              Authorization: 'Bearer ' + this.tokens.Spotify.access_token
            }
          }).then(r => {
            this.queryItems = r.data.items;

            this.processQueryItems();
          });
        }
      },

      loadTrackFromSpotifyUri(term) {
        //TODO: Get track (artist-trackName) from Spotify and query YouTube
      },

      tokenValid(provider) {
        return false;
      },

      authSpotify() {
        return new Promise((resolve, reject) => {
          if (this.tokens.Spotify && this.tokenValid(this.tokens.Spotify)) {
            resolve();
          } else {
            if (confirm('To use a Spotify URI you need to autheticate with Spotify & YouTube (you don\'t need premium to do this)\n\n Do you want to continue?')) {
              require('electron').remote.getCurrentWindow().setSize(400, 600);
              require('electron').remote.getCurrentWindow().center();

              const authEndpoint = 'https://accounts.spotify.com/authorize';

              const clientId = '991f8e478165465b9e0f2d71e9395530';
              const redirectUri = 'http://localhost:9080';
              const scopes = [
                'user-top-read'
              ];

              window.open(`${authEndpoint}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes.join('%20')}&response_type=token&show_dialog=true&state=spotify`, 'spotifyAuth')
            }
          }
        });
      },

      authYouTube() {
        return new Promise((resolve, reject) => {
          if (this.tokens.YouTube && this.tokenValid(this.tokens.YouTube)) {
            resolve();
          } else {
            const clientId = "352564315032-sj3b7g3bf9g81850065g0jpbln960mj5.apps.googleusercontent.com";
            const redirectUri= 'http://localhost:9080';
            const scope = 'https://www.googleapis.com/auth/youtube';

            window.open(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&state=youtube`, 'youtubeAuth');
          }
        });
      }
    },

    watch: {
      searchTerm (newTerm) {
        if (/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.)?youtube\.com\/watch(?:\.php)?\?.*v=)([a-zA-Z0-9\-_]+)/.test(newTerm)) {
          this.loadVideoByUrl(newTerm);
        } else if (/spotify:.*playlist:(.*)/.test(newTerm)) {

          this.authSpotify();

          this.spotifyUri = newTerm;
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

  .drag {
    display: none;
  }

  html.has-video .drag {
    position: fixed;
    color: #fff;
    display: block;
    top: 10px;
    left: 10px;
    z-index: 9999;
    font-size: 18px;
    -webkit-app-region: drag;
  }
</style>