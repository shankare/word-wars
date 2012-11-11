
;(function() {
  'use strict'

  var $doc = $(document)
    , $win = $(window)
    , $body = $('body')
    , getChar = String.fromCharCode
    , concat = Array.prototype.concat
    , speed = 5
    , current
    , ENTER = 13
    , DELETE = 8
    , imgPath = '/img/digits.png'

  // Game Engine
  // ===========

  function Game(socket, id, autoSit, priv) {
    var self = this

    this.socket = socket
    this.id = id
    this.listeners = []
    this.seats = {}
    this.autoSit = autoSit
    this.redWords = {}
    this.blueWords = {}
    this.private = priv

    // Cache selectors
    this.$el = $('#battle-mode')
    this.$input = $('#input')
    this.$red = $('#red-player .word-list')
    this.$blue = $('#blue-player .word-list')
    this.$redSeat = $('#red-seat')
    this.$blueSeat = $('#blue-seat')
    this.$notification = $('#notification')
    this.$counter = $('#counter')
    this.$sit = $('#sit')
    this.$stand = $('#stand')
    this.$ready = $('#ready')
    this.$gameOverlay = $('#game-overlay')
    this.$readyOverlay = $('#ready-overlay')
    this.$isReadyOverlay = $('#is-ready-overlay')

    this.reset()
    // Permanently focus the game input
    $win.click(function(e) {
      if (self.enabled && !self.$input.focus()) {
        self.$input.focus()
      }
    })
    // Attack and clear input if enter pressed
    this.$input
      .keypress(function(e) {
        if (self.enabled && e.which === ENTER) {
          self.attack(self.$input.val())
          self.$input.val('')
        }
      })
      .keyup(function(e) {
        self.highlight()
      })
    this.$sit.click(function() { self.sit() })
    this.$stand.click(function() { self.stand() })
    this.$ready.click(function() { self.ready() })
    return this
  }

  Game.prototype.reset = function() {
    this.words = {}
    this.players = {}
    this.pid = null
    this.redWords = {}
    this.blueWords = {}
    this.seats = {}
    return this.disableInput()
  }

  // Socket actions
  // --------------

  Game.prototype.connect = function() {
    var self = this

    if (this.connected) {
      return this
    }
    this.pid = this.socket.socket.sessionid
    this.listeners = [
      'used'
    , 'attack'
    , 'players'
    , 'block'
    , 'won'
    , 'start'
    , 'sat'
    , 'stood'
    , 'ready'
    , 'over'
    ]
    for (var i = 0; i !== self.listeners.length; i++) {
      self.socket.removeAllListeners(self.listeners[i])
    }
    this.socket.on('used',    function () { self.used.apply(self, arguments) })
    this.socket.on('over',    function () { self.over.apply(self, arguments) })
    this.socket.on('attack',  function () { self.attacked.apply(self, arguments) })    
    this.socket.on('autoattack',  function () { self.attack.apply(self, arguments) })
    this.socket.on('players', function () { self.setPlayers.apply(self, arguments) })
    this.socket.on('block',   function () { self.blocked.apply(self, arguments) })
    this.socket.on('won',     function () { self.won.apply(self, arguments) })
    this.socket.on('start',   function () { self.start.apply(self, arguments) })
    this.socket.on('sat',     function () { self.sat.apply(self, arguments) })
    this.socket.on('stood',   function () { self.stood.apply(self, arguments) })
    this.socket.on('ready',   function () { self.playerReady.apply(self, arguments) })

    this.send('join', this.id, this.private, function(e, room) {
      if (e) return

      self.id = room.id
      self.room = room

      if (window.location.hash !== room.id) {
        window.location.hash = room.id
      }

      for (var i = 0; i !== room.players.length; i++) {
        var player = room.players[i]
        self.seats[player.seat] = player.id
        player.ready && self.playerReady(player.id)
      }
      self.updateSeats()

      self.autoSit && self.sit()
    })
    this.connected = true
    return this.updateSeats()
  }
  Game.prototype.send = function() {
    this.socket.emit.apply(this.socket, arguments)
    return this
  }
  Game.prototype.setPlayers = function(players) {
    window.players = players
    return this
  }
  Game.prototype.used = function() {

    return this
  }
  Game.prototype.heights = function() {

    return this
  }
  Game.prototype.attacked = function(word, id) {

    $('#is-ready-overlay').hide()
    word = word.toLowerCase().trim()

    var $word = $('<div><p>' + word + '</p></div>')
      , $el

    if (this.getSeatByPlayer(id) === 'red') {
      $el = this.$blue
      this.blueWords[word] = $word
    } else {
      $el = this.$red
      this.redWords[word] = $word
    }
    this.animate($el, $word)
    this.updateSpacesLeft()
    return this
  }
  Game.prototype.animate = function($el, $word) {
    $el.append($word)
    this.word($word, $el)
    $word.lettering()
    return this
  }
  Game.prototype.word = function($word, $el) {
    var timeout = 1500

    $({
      position: 0
    }).animate({
      position: 90
    }, {
      duration: timeout
    , step: function (position) {
        var idx = $word.index() * 10
        if (position > (90 - idx)) {
          position = 90 - idx
          $word.data('bottom', true)
        }
        $word.css({top: position + '%'})
      }
    })
  }
  Game.prototype.reStack = function ($el, idx) {
    var timeout = 1500
    $el.children().each(function () {
      var $word = $(this)
        , wordIdx = $word.index()
        , start = 90 - wordIdx * 10
        , end   = start + 90

      if (!$word.data('bottom')) return
      if (idx - 1 >= wordIdx) return
      $({
        position: start
      }).animate({
        position: end
      }, {
        duration: timeout
      , step: function (position) {
          var idx = $word.index() * 10
          if (position > (90 - idx)) position = 90 - idx
          $word.css({top: position + '%'})
        }
      })
    })
  }
  Game.prototype.updateSpacesLeft = function() {
    var redLen = 10 - Object.keys(this.redWords).length
      , blueLen = 10 - Object.keys(this.blueWords).length

    if (this.isSitting && this.pid === this.seats.blue) {
      $('#blue-player .spaces-left').html(redLen)
      $('#red-player .spaces-left').html(blueLen)
    } else {
      $('#red-player .spaces-left').html(redLen)
      $('#blue-player .spaces-left').html(blueLen)
    }
    return this
  }
  Game.prototype.blocked = function(word, id) {
    var idx

    word = word.toLowerCase().trim()

    if (this.getSeatByPlayer(id) === 'red') {
      if (this.redWords[word]) {
        idx = this.redWords[word].index()
        this.redWords[word].remove()
        delete this.redWords[word]
        this.reStack(this.$red, idx)
      }
    } else {
      if (this.blueWords[word]) {
        idx = this.blueWords[word].index()
        this.blueWords[word].remove()
        delete this.blueWords[word]
        this.reStack(this.$blue, idx)
      }
    }
    this.updateSpacesLeft()
    return this
  }
  // Start game, display countdown
  Game.prototype.start = function() {
    var self = this
      , otherSeat = this.seats.blue

    this.isPlaying = this.isSitting
      ? true
      : false

    this.gameStarted = true

    $('.player-name').show()

    if (this.isPlaying) {
      if (this.pid === otherSeat) {
        otherSeat = this.seats.red
      }
      $('#red-player .player-name span').html('You')
    } else {
      $('#red-player .player-name span').html(getPlayerName(this.seats.red))
    }
    $('#blue-player .player-name span').html(getPlayerName(otherSeat))

    this.clearBoard()

    if (this.room.playing && !this.isSitting) return

    this.$counter
      .show()
      .countdown({
        stepTime: 60
      , format: 's'
      , startTime: '3'
      , digitImages: 6
      , digitWidth: 53
      , digitHeight: 77
      , timerEnd: function() {
          self.$counter.html('').hide()
          self.clearBoard()
          self.enableInput()
          $('#is-ready-overlay').hide()
          setTimeout(function() {

            $('#is-ready-overlay').hide()
          }, 2000)
        }
      , image: imgPath
      })

    $('#is-ready-overlay').hide()
    return this
  }
  Game.prototype.enableInput = function() {
    this.enabled = true
    this.$input.removeAttr('disabled').focus()
    return this
  }
  Game.prototype.disableInput = function() {
    this.enabled = false
    this.$input.attr('disabled', 'disabled')
    return this
  }
  Game.prototype.won = function(pid) {
    var self = this
      , me = this.pid === pid
      , msg

    this.notify('Player ' + getPlayerName(pid) + ' won!')

    if (this.isPlaying) {
      msg = me
        ? 'Victory'
        : 'Defeat'
    } else {
      msg = getPlayerName(pid) + ' won'
    }

    this.$gameOverlay.show().html('<span>' + msg + '</span>')
    this.clearBoard()

    this.tick = setTimeout(function() {
      self.$gameOverlay
        .html('<span>Game Over</span>')
        .fadeOut(5000, function() {
          self.over()
        })
    }, 5 * 1000)
    return this
  }
  Game.prototype.over = function() {
    if (this.gameStarted) {

    }
    $('.player-name').hide()
    this.gameStarted = false
    return this
      .clearBoard()
      .disableInput()
      .updateSeats()
  }
  // Player has quit the game
  Game.prototype.quit = function() {
    var self = this

    if (this.isPlaying || this.isSitting) {
      this.clearBoard()
    }
    this.send('leave', this.id, function(e) {
      for (var i = 0; i !== self.listeners.length; i++) {
        self.socket.removeAllListeners(self.listeners[i])
      }
      self.connected = false
    })
    return this.reset()
  }
  Game.prototype.sat = function(id, seat) {
    if (id === this.pid) {
      this.isSitting = true
      if (this.getSeat(seat) === 'blue') {
        this.$red = $('#blue-player .word-list')
        this.$blue = $('#red-player .word-list')
        this.$redSeat = $('#blue-seat')
        this.$blueSeat = $('#red-seat')
      }
    }
    this.seats[this.getSeat(seat)] = id
    return this.updateSeats()
  }
  Game.prototype.stood = function(id) {
    if (id === this.pid) {
      this.isSitting = false
    }
    this.seats[this.getSeatByPlayer(id)] = null
    return this.updateSeats()
  }

  // Normalize seat names for security
  Game.prototype.getSeat = function(seat) {
    return seat === 'red' ? 'red' : 'blue'
  }
  Game.prototype.getSeatByPlayer = function (playerId) {
    var self = this
      , seat

    Object.keys(this.seats).forEach(function (key) {
      if (self.seats[key] === playerId) seat = key
    })
    return seat
  }
  Game.prototype.getPlayer = function(seat) {
    return this.seats[this.getSeat(seat)]
  }
  Game.prototype.playerReady = function(pid) {
    if (pid !== this.pid && !this.gameStarted) {
      this.$isReadyOverlay.show()
    }
    return this
  }

  // Game actions
  // ------------

  Game.prototype.sit = function(el, e) {
    if (this.isSitting || (this.seats.red && this.seats.blue)) {
      return this
    }
    var self = this
    this.send('sit', this.id, function(err) {
      err && self.notify(err)
    })
    return this
  }
  Game.prototype.stand = function() {
    if (!this.isSitting) {
      return this
    }
    var self = this
    this.send('stand', this.id, function(err) {
      err && self.notify(err)
    })
    return this
  }
  Game.prototype.ready = function() {
    if (!this.isSitting) {
      return this
    }
    var self = this
      self.$readyOverlay.show()
    this.send('playerReady', this.id, function(err) {
      err && self.notify(err)
    })
    return this
  }
  Game.prototype.updateWords = function() {
    var self = this

    if (this.room.playing) this.start()

    this.room.players.forEach(function (player) {
      var seat = player.seat
        , words = player.currentWords

      words.forEach(function (word) {
        word = word.toLowerCase().trim()

        var $word = $('<div><p>' + word + '</p></div>')
          , $el

        if (seat === 'red') {
          $el = self.$red
          self.redWords[word] = $word
        } else {
          $el = self.$blue
          self.blueWords[word] = $word
        }

        $el.append($word)

        var idx = $word.index() * 10
          , position

        position = 90 - idx
        $word.data('bottom', true)
        $word.css({top: position + '%'})
        $word.lettering()
        self.updateSpacesLeft()
      })
    })

    return this
  }
  Game.prototype.updateSeats = function() {
    var self = this
      , pid = this.pid
      , red = this.seats.red
      , blue = this.seats.blue
      , $other = this.$el.find('#blue-player .player')
    
    $('.player strong').html('')
    $('#red-player .player').hide()

    // Both players sitting
    if (red && blue) {
      $('#vs').show()
      this.$sit.hide()
      var forOther = blue
      if (pid === blue) {
        forOther = red
      }
      $other.show().find('strong').html(getPlayerName(forOther))
      if (!this.isSitting) {
        $('#red-player .player').show().find('strong').html(getPlayerName(red))
        this.updateWords()
      }
    // One player sitting
    } else if (red || blue) {
      // You are sitting
      if (pid === blue || pid === red) {
        $other.hide()
        this.$sit.hide()
      // Someone else is sitting
      } else {
        $other.show().find('strong').html(getPlayerName(red || blue))
        this.$sit.show()
        this.$ready.hide()
        this.$stand.hide()
      }
    // No players sitting
    } else {
      this.$el.find('.player').hide()
      this.$sit.show()
      this.$stand.hide()
      this.$ready.hide()
    }
    if (this.isSitting) {
      this.$stand.show()
      this.$ready.show()
      this.$sit.hide()
    }
    return this
  }
  Game.prototype.fail = function() {

    return this
  }

  Game.prototype.win = function() {

    return this
  }
  Game.prototype.clearBoard = function() {
    this.$el.find('.player').hide()
    this.$sit.hide()
    this.$stand.hide()
    this.$ready.hide()
    this.$readyOverlay.hide()
    this.$isReadyOverlay.hide()
    this.redWords = {}
    this.blueWords = {}
    $('.spaces-left').html('10')
    $('.word-list').html('')
    $('#is-ready-overlay').hide()
    $('.player-name').hide()
    $('#vs').hide()
    return this
  }
  Game.prototype.attack = function(word) {
    var self = this
    if (!this.enabled) return
    this.send('attack', word, function (err) {
      if (err) {
        return self.notify(err)
      }
    })
    return this
  }
  Game.prototype.notify = function(msg) {
    this.$notification
      .show()
      .html(msg)
      .delay(3000)
      .fadeOut(2000)
    return this
  }
  Game.prototype.highlight = function() {
    var val = this.$input.val()
      , words

    if (this.getSeatByPlayer(this.pid) === 'red') {
      words = this.redWords
    } else {
      words = this.blueWords
    }

    for (var word in words) {
      var $word = words[word]
        , children = $word.children()

      // Reset word color
      $word.find('span').css('color', '#000000')

      // Part of input found in word
      if (val.length && word.substring(0, val.length) === val) {
        for (var i = 0; i !== children.length && i !== val.length; i++) {
          $(children[i]).css('color', '#ff0000')
        }
      }
    }
    return this
  }

  window.Game = Game

}).call(this)
