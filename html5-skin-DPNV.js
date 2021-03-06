(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var CONSTANTS = require('./../constants/constants');

var AccessibilityControls = function (controller) {
    this.controller = controller;
    this.state = {
      "fastForwardRate": 1,
      "lastKeyDownTime": null
    };
    document.addEventListener("keydown", this.handleKey.bind(this));
};
module.exports = AccessibilityControls;

AccessibilityControls.prototype = {
  handleKey: function(e) {
    if (!this.controller.state.accessibilityControlsEnabled){
      return;
    }

    var currentTime;
    var newPlayheadTime;
    var newVolume;

    if (e.keyCode === CONSTANTS.KEYCODES.SPACE_KEY){
      e.preventDefault();
      this.controller.togglePlayPause();
    }

    else if ((e.keyCode === CONSTANTS.KEYCODES.DOWN_ARROW_KEY && this.controller.state.volumeState.volume > 0) || (e.keyCode === CONSTANTS.KEYCODES.UP_ARROW_KEY && this.controller.state.volumeState.volume < 1)){
      e.preventDefault();
      var deltaVolumeSign = 1; // positive 1 for volume increase, negative for decrease

      if (e.keyCode === CONSTANTS.KEYCODES.DOWN_ARROW_KEY){
        deltaVolumeSign = -1;
      }
      else {
        deltaVolumeSign = 1;
      }

      newVolume = (this.controller.state.volumeState.volume * 10 + 1*deltaVolumeSign)/10;
      this.controller.setVolume(newVolume);
    }

    else if (e.keyCode === CONSTANTS.KEYCODES.RIGHT_ARROW_KEY || e.keyCode === CONSTANTS.KEYCODES.LEFT_ARROW_KEY){
      e.preventDefault();
      var shiftSign = 1; // positive 1 for fast forward, negative for rewind back

      var shiftSeconds = 1;
      var fastForwardRateIncrease = 1.1;

      currentTime = Date.now();
      if (this.state.lastKeyDownTime && currentTime - this.state.lastKeyDownTime < 500){
        //increasing the fast forward rate to go faster if key is pressed often
        if (this.state.fastForwardRate < 300){
          this.state.fastForwardRate *= fastForwardRateIncrease;
        }
      }
      else {
        this.state.fastForwardRate = 1;
      }

      this.state.lastKeyDownTime = currentTime;
      if (e.keyCode === CONSTANTS.KEYCODES.RIGHT_ARROW_KEY){
        shiftSign = 1;
      }
      else {
        shiftSign = -1;
      }

      newPlayheadTime = this.controller.skin.state.currentPlayhead + shiftSign*shiftSeconds * this.state.fastForwardRate;
      this.controller.seek(newPlayheadTime);
    }
  }
};

},{"./../constants/constants":36}],2:[function(require,module,exports){
/********************************************************************
  AD OVERLAY
*********************************************************************/
var React = require('react'),
    ClassNames = require('classnames'),
    CloseButton = require('./closeButton'),
    CONSTANTS = require('../constants/constants');

var AdOverlay = React.createClass({displayName: "AdOverlay",
  closeOverlay: function() {
    this.props.controller.closeNonlinearAd();
    this.props.controller.onSkipAdClicked();
  },

  handleOverlayClick: function() {
    this.props.controller.onAdsClicked(CONSTANTS.AD_CLICK_SOURCE.OVERLAY);
  },

  overlayLoaded: function() {
    if (this.props.overlay && this.props.showOverlay){
      this.props.controller.onAdOverlayLoaded();
    }
  },

  render: function() {
    var adOverlayClass = ClassNames({
      "oo-ad-overlay": true,
      "oo-hidden": !this.props.overlay && this.props.showOverlay
    });
    var closeButtonClass = ClassNames({
      "oo-ad-overlay-close-button": true,
      "oo-hidden": !this.props.showOverlayCloseButton
    });

    return (
      React.createElement("div", {className: adOverlayClass}, 
        React.createElement("a", {onClick: this.handleOverlayClick}, 
          React.createElement("img", {src: this.props.overlay, className: "oo-ad-overlay-image", onLoad: this.overlayLoaded})
        ), 
        React.createElement(CloseButton, React.__spread({},  this.props, 
          {cssClass: closeButtonClass, 
          closeAction: this.closeOverlay, 
          className: "oo-ad-overlay-close-button-icon", 
          ref: "adOverlayCloseButton"}))
      )
    );
  }
});
module.exports = AdOverlay;

},{"../constants/constants":36,"./closeButton":4,"classnames":51,"react":212}],3:[function(require,module,exports){
/********************************************************************
 AD PANEL
 *********************************************************************/
/**
 * The screen used while the video is playing.
 *
 * @class AdPanel
 * @constructor
 */
var React = require('react'),
  CONSTANTS = require('../constants/constants'),
  Spinner = require('./spinner'),
  ClassNames = require('classnames'),
  Utils = require('./utils'),
  Icon = require('../components/icon');

var AdPanelTopBarItem = React.createClass({displayName: "AdPanelTopBarItem",
  render: function() {
    return (
      React.createElement("a", {className: this.props.itemClassName, onClick: this.props.onButtonClicked}, 
        this.props.children
      )
    );
  }
});

var AdPanel = React.createClass({displayName: "AdPanel",
  getInitialState: function() {
    this.isMobile = this.props.controller.state.isMobile;
    return null;
  },

  handleSkipAdButtonClick: function() {
    this.props.controller.onSkipAdClicked();
  },

  handleLearnMoreButtonClick: function() {
    this.props.controller.onAdsClicked(CONSTANTS.AD_CLICK_SOURCE.LEARN_MORE_BUTTON);
  },

  handleAdTopBarClick: function(event){
    if (event.type == 'touchend' || !this.isMobile) {
      //since mobile would fire both click and touched events,
      //we need to make sure only one actually does the work
      event.stopPropagation(); // W3C
      event.cancelBubble = true; // IE
    }
  },

  isValidAdPlaybackInfo: function(playbackInfo) {
    return (playbackInfo !== null &&
      typeof playbackInfo !== 'undefined' &&
      playbackInfo !== "");
  },

  populateAdTopBar: function() {
    var adTopBarItems = [];

    // // Ad title
    var adTitle = this.props.currentAdsInfo.currentAdItem.name;
    // AMC puts "Unknown" in the name field if ad name unavailable
    if (this.isValidAdPlaybackInfo(adTitle) && this.props.componentWidth > 560) {
      var adTitleDiv = React.createElement(AdPanelTopBarItem, {key: "adTitle", ref: "adTitle", itemClassName: "oo-ad-title"}, adTitle);
      adTopBarItems.push(adTitleDiv);
    }

    // Ad playback Info
    var adPlaybackInfo = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.AD, this.props.localizableStrings);
    var currentAdIndex = this.props.currentAdsInfo.currentAdItem.indexInPod;
    var totalNumberOfAds = this.props.currentAdsInfo.numberOfAds;
    if (this.isValidAdPlaybackInfo(currentAdIndex) && this.isValidAdPlaybackInfo(totalNumberOfAds)) {
      adPlaybackInfo = adPlaybackInfo + ": (" + currentAdIndex + "/" + totalNumberOfAds + ")";
    }

    var isLive = this.props.currentAdsInfo.currentAdItem.isLive;

    var remainingTime;
    if (isLive) {
      remainingTime = parseInt((this.props.adStartTime + this.props.adVideoDuration * 1000 - new Date().getTime())/1000);
    } else {
      remainingTime = parseInt(this.props.adVideoDuration - this.props.currentPlayhead)
    }
    remainingTime = Utils.formatSeconds(Math.max(0, remainingTime));

    adPlaybackInfo = adPlaybackInfo + " - " + remainingTime;

    var adPlaybackInfoDiv = React.createElement(AdPanelTopBarItem, {key: "adPlaybackInfo", itemClassName: "oo-ad-playback-info"}, adPlaybackInfo);
    adTopBarItems.push(adPlaybackInfoDiv);

    // Flexible space
    var flexibleSpaceDiv = React.createElement(AdPanelTopBarItem, {key: "flexibleSpace", itemClassName: "oo-flexible-space"});
    adTopBarItems.push(flexibleSpaceDiv);

    // Learn more
    var learnMoreClass = ClassNames({
      "oo-learn-more": true,
      "oo-hidden": !this.props.currentAdsInfo.currentAdItem.hasClickUrl
    });
    if (this.props.currentAdsInfo.currentAdItem !== null && this.isValidAdPlaybackInfo(this.props.currentAdsInfo.currentAdItem.hasClickUrl)) {
      var learnMoreText = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.LEARN_MORE, this.props.localizableStrings);
      var learnMoreButtonDiv = React.createElement(AdPanelTopBarItem, {key: "learnMoreButton", ref: "learnMoreButton", 
                                onButtonClicked: this.handleLearnMoreButtonClick, itemClassName: learnMoreClass}, 
                                  React.createElement(Icon, React.__spread({},  this.props, {icon: "learn", className: "oo-button-icon"})), 
                                  learnMoreText
                              );
      adTopBarItems.push(learnMoreButtonDiv);
    }

    // Skip
    var skipButtonClass = ClassNames({
      "oo-skip-button": true,
      "oo-visible": this.props.currentAdsInfo.skipAdButtonEnabled,
      "oo-enabled": this.props.currentAdsInfo.skipAdButtonEnabled
    });
    var skipButtonText = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.SKIP_AD, this.props.localizableStrings);
    var skipButtonDiv = React.createElement(AdPanelTopBarItem, {key: "skipButton", ref: "skipButton", 
                          onButtonClicked: this.handleSkipAdButtonClick, itemClassName: skipButtonClass}, 
                          React.createElement(Icon, React.__spread({},  this.props, {icon: "skip", className: "oo-button-icon"})), 
                            skipButtonText
                        );
    adTopBarItems.push(skipButtonDiv);

    return adTopBarItems;
  },


  render: function() {
    var spinner = null;
    if (this.props.controller.state.buffering === true) {
      spinner = React.createElement(Spinner, {loadingImage: this.props.skinConfig.general.loadingImage.imageResource.url});
    }
    var adTopBarItems = this.populateAdTopBar();
    return (
      React.createElement("div", {className: "oo-ad-screen-panel"}, 
        spinner, 
        React.createElement("div", {className: "oo-ad-top-bar", ref: "adTopBar", onClick: this.handleAdTopBarClick, onTouchEnd: this.handleAdTopBarClick}, 
          adTopBarItems
        )
      )
    );
  }
});

AdPanel.defaultProps = {
  currentPlayhead: 0,
  adVideoDuration: 0,
  adStartTime: 0,
  currentAdsInfo: {
    numberOfAds: 0,
    skipAdButtonEnabled: false,
    currentAdItem: {
      hasClickUrl: false,
      name: "",
      indexInPod: 0,
      isLive: false
    }
  }
};

module.exports = AdPanel;

},{"../components/icon":22,"../constants/constants":36,"./spinner":28,"./utils":34,"classnames":51,"react":212}],4:[function(require,module,exports){
var React = require('react'),
    Icon = require('../components/icon');

var CloseButton = React.createClass({displayName: "CloseButton",
  render: function() {
    return (
        React.createElement("button", {className: this.props.cssClass, 
          onClick: this.props.closeAction}, 
          React.createElement(Icon, React.__spread({},  this.props, {icon: "dismiss", 
            className: this.props.className}))
        )
    );
  }
});

CloseButton.propTypes = {
  closeAction: React.PropTypes.func,
  fontStyleClass: React.PropTypes.string,
  cssClass: React.PropTypes.string
};

CloseButton.defaultProps = {
  cssClass: 'oo-close-button'
};

module.exports = CloseButton;

},{"../components/icon":22,"react":212}],5:[function(require,module,exports){
var React = require('react'),
    ClassNames = require('classnames'),
    Utils = require('../utils'),
    CONSTANTS = require('../../constants/constants'),
    SelectionContainer = require('./selectionContainer'),
    Slider = require('../slider');

var CaptionOpacityTab = React.createClass({displayName: "CaptionOpacityTab",

  changeTextOpacity: function(event) {
    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }
    var value = event.target.value;
    this.props.controller.onClosedCaptionChange('textOpacity', value);
  },

  changeBackgroundOpacity: function(event) {
    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }
    var value = event.target.value;
    this.props.controller.onClosedCaptionChange('backgroundOpacity', value);
  },

  changeWindowOpacity: function(event) {
    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }
    var value = event.target.value;
    this.props.controller.onClosedCaptionChange('windowOpacity', value);
  },

  percentString: function(number) {
    //if (number == 0) return "Transparent";
    return (number * 100).toString() + "%"
  },

  render: function(){

    var textOpacityTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.TEXT_OPACITY, this.props.localizableStrings);
    var backgroundOpacityTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.BACKGROUND_OPACITY, this.props.localizableStrings);
    var windowOpacityTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.WINDOW_OPACITY, this.props.localizableStrings);

    return(
      React.createElement("div", {className: "oo-caption-opacity-tab"}, 
        React.createElement("div", {className: "oo-caption-opacity-inner-wrapper"}, 
          React.createElement(SelectionContainer, {
            title: textOpacityTitle, 
            selectionText: this.percentString(this.props.closedCaptionOptions.textOpacity)
            }, 
            React.createElement(Slider, {
              value: parseFloat(this.props.closedCaptionOptions.textOpacity), 
              onChange: this.changeTextOpacity, 
              className: "oo-slider oo-slider-caption-opacity", 
              itemRef: "textOpacitySlider", 
              minValue: "0", 
              maxValue: "1", 
              step: "0.1"}
            )
          ), 

          React.createElement(SelectionContainer, {
            title: backgroundOpacityTitle, 
            selectionText: this.percentString(this.props.closedCaptionOptions.backgroundOpacity)
            }, 
            React.createElement(Slider, {
              value: parseFloat(this.props.closedCaptionOptions.backgroundOpacity), 
              onChange: this.changeBackgroundOpacity, 
              className: "oo-slider oo-slider-caption-opacity", 
              itemRef: "backgroundOpacitySlider", 
              minValue: "0", 
              maxValue: "1", 
              step: "0.1"}
            )
          ), 

          React.createElement(SelectionContainer, {
            title: windowOpacityTitle, 
            selectionText: this.percentString(this.props.closedCaptionOptions.windowOpacity)
            }, 
            React.createElement(Slider, {
              value: parseFloat(this.props.closedCaptionOptions.windowOpacity), 
              onChange: this.changeWindowOpacity, 
              className: "oo-slider oo-slider-caption-opacity", 
              itemRef: "windowOpacitySlider", 
              minValue: "0", 
              maxValue: "1", 
              step: "0.1"}
            )
          )
        )
      )
    );
  }
});

module.exports = CaptionOpacityTab;

},{"../../constants/constants":36,"../slider":27,"../utils":34,"./selectionContainer":14,"classnames":51,"react":212}],6:[function(require,module,exports){
var React = require('react'),
    Utils = require('../utils'),
    CONSTANTS = require('../../constants/constants'),
    ClassNames = require('classnames'),
    TextTrack = require('../textTrackPanel');

var CCPreviewPanel = React.createClass({displayName: "CCPreviewPanel",
  render: function(){
    var closedCaptionPreviewTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.CLOSED_CAPTION_PREVIEW, this.props.localizableStrings);
    var closedCaptionSampleText = Utils.getLocalizedString(this.props.closedCaptionOptions.language, CONSTANTS.SKIN_TEXT.SAMPLE_TEXT, this.props.localizableStrings);
    if (!closedCaptionSampleText) closedCaptionSampleText = Utils.getLocalizedString('en', CONSTANTS.SKIN_TEXT.SAMPLE_TEXT, this.props.localizableStrings);

    var previewCaptionClassName = ClassNames({
      'oo-preview-caption': true,
      'oo-disabled': !this.props.closedCaptionOptions.enabled
    });
    var previewTextClassName = ClassNames({
      'oo-preview-text': true,
      'oo-disabled': !this.props.closedCaptionOptions.enabled
    });

    return (
      React.createElement("div", {className: "oo-preview-panel"}, 
        React.createElement("div", {className: previewCaptionClassName}, closedCaptionPreviewTitle), 
        React.createElement(TextTrack, React.__spread({},  this.props, {cueText: closedCaptionSampleText}))
      )
    );
  }
});

module.exports = CCPreviewPanel;

},{"../../constants/constants":36,"../textTrackPanel":30,"../utils":34,"classnames":51,"react":212}],7:[function(require,module,exports){
/********************************************************************
  CLOSED CAPTION PANEL
*********************************************************************/
/**
* Closed caption settings screen.
*
* @class ClosedCaptionPanel
* @constructor
*/
var React = require('react'),
    Utils = require('../utils'),
    CONSTANTS = require('../../constants/constants'),
    LanguageTab = require('./languageTab'),
    ColorSelectionTab = require('./colorSelectionTab'),
    CaptionOpacityTab = require('./captionOpacityTab'),
    FontTypeTab = require('./fontTypeTab'),
    FontSizeTab = require('./fontSizeTab'),
    TextEnhancementsTab = require('./textEnhancementsTab'),
    CCPreviewPanel = require('./ccPreviewPanel'),
    Tabs = require('../tabs'),
    Tab = Tabs.Panel;

//The scroll buttons are not needed until the player's width is below a specific amount. This varies by language.
var tabMenuOverflowMap = {
  "en": 730,
  "es": 995,
  "zh": 610
};

var ClosedCaptionPanel = React.createClass({displayName: "ClosedCaptionPanel",
  render: function(){

    var languageTabTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.LANGUAGE_TAB_TITLE, this.props.localizableStrings);
    var colorSelectionTabTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.COLOR_SELECTION_TAB_TITLE, this.props.localizableStrings);
    var captionOpacityTabTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.CAPTION_OPACITY_TAB_TITLE, this.props.localizableStrings);
    var fontTypeTabTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.FONT_TYPE_TAB_TITLE, this.props.localizableStrings);
    var fontSizeTabTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.FONT_SIZE_TAB_TITLE, this.props.localizableStrings);
    var textEnhancementsTabTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.TEXT_ENHANCEMENTS_TAB_TITLE, this.props.localizableStrings);

    return (
        React.createElement("div", {className: "oo-content-panel oo-closed-captions-panel"}, 
          React.createElement(Tabs, React.__spread({
            className: "captions-navbar", 
            showScrollButtons: this.props.componentWidth < tabMenuOverflowMap[this.props.language]}, 
            this.props), 
            React.createElement(Tab, {title: languageTabTitle}, 
              React.createElement(LanguageTab, React.__spread({},  this.props))
            ), 
            React.createElement(Tab, {title: colorSelectionTabTitle}, 
              React.createElement(ColorSelectionTab, React.__spread({},  this.props))
            ), 
            React.createElement(Tab, {title: captionOpacityTabTitle}, 
              React.createElement(CaptionOpacityTab, React.__spread({},  this.props))
            ), 
            React.createElement(Tab, {title: fontTypeTabTitle}, 
              React.createElement(FontTypeTab, React.__spread({},  this.props))
            ), 
            React.createElement(Tab, {title: fontSizeTabTitle}, 
              React.createElement(FontSizeTab, React.__spread({},  this.props))
            ), 
            React.createElement(Tab, {title: textEnhancementsTabTitle}, 
              React.createElement(TextEnhancementsTab, React.__spread({},  this.props))
            )
          ), 

          React.createElement(CCPreviewPanel, React.__spread({},  this.props))
        )
    );
  }
});

module.exports = ClosedCaptionPanel;

},{"../../constants/constants":36,"../tabs":29,"../utils":34,"./captionOpacityTab":5,"./ccPreviewPanel":6,"./colorSelectionTab":9,"./fontSizeTab":10,"./fontTypeTab":11,"./languageTab":12,"./textEnhancementsTab":15,"react":212}],8:[function(require,module,exports){
var React = require('react'),
    CONSTANTS = require('../../constants/constants'),
    OnOffSwitch = require('./onOffSwitch'),
    CloseButton = require('../closeButton');

var ClosedCaptionPopover = React.createClass({displayName: "ClosedCaptionPopover",

  handleMoreCaptions: function() {
    this.props.controller.toggleScreen(CONSTANTS.SCREEN.CLOSEDCAPTION_SCREEN);
    this.handleClose();
  },

  handleClose: function() {
    this.props.togglePopoverAction();
  },

  render: function() {
    return (
      React.createElement("ul", {className: "oo-popover-horizontal"}, 
        React.createElement("li", null, 
          React.createElement(OnOffSwitch, React.__spread({},  this.props))
        ), 
        React.createElement("li", null, 
          React.createElement("a", {className: "oo-more-captions", onClick: this.handleMoreCaptions}, "Language & Captions")
        ), 
        React.createElement("li", null, 
          React.createElement(CloseButton, React.__spread({},  this.props, {closeAction: this.handleClose}))
        )
      )
    );
  }
});

module.exports = ClosedCaptionPopover;

},{"../../constants/constants":36,"../closeButton":4,"./onOffSwitch":13,"react":212}],9:[function(require,module,exports){
var React = require('react'),
    Utils = require('../utils'),
    CONSTANTS = require('../../constants/constants'),
    SelectionContainer = require('./selectionContainer'),
    ColorSelector = require('../colorSelector');

var ColorSelectionTab = React.createClass({displayName: "ColorSelectionTab",

  getInitialState: function() {
    return {
      selectedTextColor: this.props.closedCaptionOptions.textColor,
      selectedWindowColor: this.props.closedCaptionOptions.windowColor,
      selectedBackgroundColor: this.props.closedCaptionOptions.backgroundColor,
      textColors: ["White", "Blue", "Magenta", "Green", "Yellow", "Red", "Cyan", "Black"],
      windowColors: ["Transparent", "White", "Blue", "Magenta", "Green", "Yellow", "Red", "Cyan", "Black"],
      backgroundColors: ["Transparent", "White", "Blue", "Magenta", "Green", "Yellow", "Red", "Cyan", "Black"]
    };
  },

  changeTextColor: function(color){
    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }
    this.props.controller.onClosedCaptionChange('textColor', color);
    this.setState({
      selectedTextColor: color
    });
  },

  changeWindowColor: function(color){
    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }
    this.props.controller.onClosedCaptionChange('windowColor', color);
    this.setState({
      selectedWindowColor: color
    });
  },

  changeBackgroundColor: function(color){
    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }
    this.props.controller.onClosedCaptionChange('backgroundColor', color);
    this.setState({
      selectedBackgroundColor: color
    });
  },

  render: function(){

    var textColorTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.TEXT_COLOR, this.props.localizableStrings);
    var textColorSelection = Utils.getLocalizedString(
      this.props.language,
      CONSTANTS.SKIN_TEXT[this.props.closedCaptionOptions.textColor.toUpperCase()],
      this.props.localizableStrings
    );

    var backgroundColorTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.BACKGROUND_COLOR, this.props.localizableStrings);
    var backgroundColorSelection = Utils.getLocalizedString(
      this.props.language,
      CONSTANTS.SKIN_TEXT[this.props.closedCaptionOptions.backgroundColor.toUpperCase()],
      this.props.localizableStrings
    );

    var windowColorTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.WINDOW_COLOR, this.props.localizableStrings);
    var windowColorSelection = Utils.getLocalizedString(
      this.props.language,
      CONSTANTS.SKIN_TEXT[this.props.closedCaptionOptions.windowColor.toUpperCase()],
      this.props.localizableStrings
    );

    return(
      React.createElement("div", {className: "oo-color-selection-tab"}, 
        React.createElement("div", {className: "oo-color-selection-inner-wrapper"}, 
          React.createElement(SelectionContainer, {
            className: "oo-text-color-selection-container", 
            title: textColorTitle, 
            selectionText: textColorSelection
            }, 
            React.createElement("div", {className: "oo-text-color-items-container"}, 
              React.createElement(ColorSelector, {
                colors: this.state.textColors, 
                onColorChange: this.changeTextColor, 
                selectedColor: this.props.closedCaptionOptions.textColor, 
                enabled: this.props.closedCaptionOptions.enabled}
              )
            )
          ), 

          React.createElement(SelectionContainer, {
            title: backgroundColorTitle, 
            selectionText: backgroundColorSelection
            }, 
            React.createElement(ColorSelector, {
              colors: this.state.backgroundColors, 
              onColorChange: this.changeBackgroundColor, 
              selectedColor: this.props.closedCaptionOptions.backgroundColor, 
              enabled: this.props.closedCaptionOptions.enabled}
            )
          ), 

          React.createElement(SelectionContainer, {
            title: windowColorTitle, 
            selectionText: windowColorSelection
            }, 
            React.createElement(ColorSelector, {
              colors: this.state.windowColors, 
              onColorChange: this.changeWindowColor, 
              selectedColor: this.props.closedCaptionOptions.windowColor, 
              enabled: this.props.closedCaptionOptions.enabled}
            )
          )
        )
      )
    );
  }
});

module.exports = ColorSelectionTab;

},{"../../constants/constants":36,"../colorSelector":16,"../utils":34,"./selectionContainer":14,"react":212}],10:[function(require,module,exports){
var React = require('react'),
    ClassNames = require('classnames'),
    Utils = require('../utils'),
    CONSTANTS = require('../../constants/constants'),
    SelectionContainer = require('./selectionContainer');

var FontSizeTab = React.createClass({displayName: "FontSizeTab",
  getInitialState: function() {
    return {
      selectedFontSize: this.props.closedCaptionOptions.fontSize,
      fontSizes: ["Small", "Medium", "Large", "Extra Large"]
    };
  },

  changeFontSize: function(fontSize) {
    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }
    this.props.controller.onClosedCaptionChange('fontSize', fontSize);
    this.setState({
      selectedFontSize: fontSize
    });
  },

  setClassname: function(item, elementType) {
    return ClassNames({
      'oo-font-size-letter': elementType == "letter",
      'oo-font-size-label': elementType == "label",
      'oo-font-size-selected': this.props.closedCaptionOptions.fontSize == item && this.props.closedCaptionOptions.enabled,
      'oo-font-size-label-selected': this.props.closedCaptionOptions.fontSize == item && this.props.closedCaptionOptions.enabled && elementType == "label",
      'oo-disabled': !this.props.closedCaptionOptions.enabled
    });
  },

  render: function() {
    var fontSizeTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.FONT_SIZE, this.props.localizableStrings);
    var fontSizeSelection = Utils.getLocalizedString(
      this.props.language,
      CONSTANTS.SKIN_TEXT[this.props.closedCaptionOptions.fontSize.toUpperCase().replace(" ", "_")],
      this.props.localizableStrings
    );

    var fontItems = [];
    for(var i = 0; i < this.state.fontSizes.length; i++) {
      fontItems.push(
        React.createElement("a", {className: "oo-font-size-container", onClick: this.changeFontSize.bind(this, this.state.fontSizes[i]), key: i}, 
          React.createElement("div", {className: this.setClassname(this.state.fontSizes[i], "letter") + " oo-font-size-letter-" + this.state.fontSizes[i].replace(" ", "-")}, "A"), 
          React.createElement("div", {className: this.setClassname(this.state.fontSizes[i], "label")}, 
            Utils.getLocalizedString(
              this.props.language,
              CONSTANTS.SKIN_TEXT[this.state.fontSizes[i].toUpperCase().replace(" ", "_")],
              this.props.localizableStrings
            )
          )
        )
      );
    }

    return (
      React.createElement("div", {className: "oo-font-size-tab"}, 
        React.createElement("div", {className: "oo-font-size-inner-wrapper"}, 
          React.createElement(SelectionContainer, {
            title: fontSizeTitle, 
            selectionText: fontSizeSelection
            }, 
            fontItems
          )
        )
      )
    );
  }
});

module.exports = FontSizeTab;

},{"../../constants/constants":36,"../utils":34,"./selectionContainer":14,"classnames":51,"react":212}],11:[function(require,module,exports){
var React = require('react'),
    DataSelector = require('../dataSelector');

var FontTypeTab = React.createClass({displayName: "FontTypeTab",
  getInitialState: function() {
    return {
      selectedFontType: this.props.closedCaptionOptions.fontType,
      availableFontTypes: ["Monospaced Serif", "Proportional Serif", "Monospaced Sans-Serif", "Proportional Sans-Serif", "Casual", "Cursive", "Small Capitals"]
    };
  },

  changeFontType: function(fontType) {
    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }
    this.props.controller.onClosedCaptionChange('fontType', fontType);
    this.setState({
      selectedFontType: fontType
    });
  },

  render: function(){
    return(
      React.createElement("div", {className: "oo-font-type-tab"}, 
        React.createElement(DataSelector, React.__spread({}, 
          this.props, 
          {viewSize: this.props.responsiveView, 
          dataItemsPerPage: this.props.dataItemsPerPage, 
          selectedData: this.state.selectedFontType, 
          enabled: this.props.closedCaptionOptions.enabled, 
          availableDataItems: this.state.availableFontTypes, 
          onDataChange: this.changeFontType})
        )
      )
    );
  }
});

FontTypeTab.propTypes = {
  dataItemsPerPage: React.PropTypes.objectOf(React.PropTypes.number)
};

FontTypeTab.defaultProps = {
  dataItemsPerPage: {
    xs: 1,
    sm: 4,
    md: 8,
    lg: 8
  },
  responsiveView: 'md'
};

module.exports = FontTypeTab;

},{"../dataSelector":19,"react":212}],12:[function(require,module,exports){
var React = require('react'),
    DataSelector = require('../dataSelector'),
    values = require('lodash.values');

var LanguageTab = React.createClass({displayName: "LanguageTab",
  getInitialState: function() {
    return {
      selectedLanguage: this.props.closedCaptionOptions.availableLanguages.locale[this.props.closedCaptionOptions.language]
    };
  },

  changeLanguage: function(language){
    var availableLanguages = this.props.closedCaptionOptions.availableLanguages;
    var invertedLocale = {};
    for (var i = 0; i < availableLanguages.languages.length; i++) {
      invertedLocale[availableLanguages.locale[availableLanguages.languages[i]]] = availableLanguages.languages[i];
    }

    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }

    this.props.controller.onClosedCaptionChange('language', invertedLocale[language]);
    this.setState({
      selectedLanguage: language
    });
  },

  render: function(){
    return(
      React.createElement("div", {className: "oo-language-tab"}, 
        React.createElement(DataSelector, React.__spread({}, 
          this.props, 
          {viewSize: this.props.responsiveView, 
          dataItemsPerPage: this.props.dataItemsPerPage, 
          selectedData: this.state.selectedLanguage, 
          enabled: this.props.closedCaptionOptions.enabled, 
          availableDataItems: values(this.props.closedCaptionOptions.availableLanguages.locale), 
          onDataChange: this.changeLanguage})
        )
      )
    );
  }
});

LanguageTab.propTypes = {
  dataItemsPerPage: React.PropTypes.objectOf(React.PropTypes.number)
};

LanguageTab.defaultProps = {
  dataItemsPerPage: {
    xs: 1,
    sm: 4,
    md: 8,
    lg: 8
  },
  responsiveView: 'md'
};

module.exports = LanguageTab;

},{"../dataSelector":19,"lodash.values":53,"react":212}],13:[function(require,module,exports){
var React = require('react'),
    Utils = require('./../utils'),
    CONSTANTS = require('../../constants/constants'),
    ClassNames = require('classnames');

var OnOffSwitch = React.createClass({displayName: "OnOffSwitch",
  handleOnOffSwitch: function() {
    this.props.controller.toggleClosedCaptionEnabled();
  },

  render: function(){
    var switchThumbClassName = ClassNames({
      'oo-switch-thumb': true,
      'oo-switch-thumb-on': this.props.closedCaptionOptions.enabled,
      'oo-switch-thumb-off': !this.props.closedCaptionOptions.enabled
    });
    var switchBodyClassName = ClassNames({
      'oo-switch-body': true,
      'oo-switch-body-off': !this.props.closedCaptionOptions.enabled
    });
    var onCaptionClassName = ClassNames({
      'oo-switch-captions oo-switch-captions-on': true,
      'oo-switch-captions-active': this.props.closedCaptionOptions.enabled
    });
    var offCaptionClassName = ClassNames({
      'oo-switch-captions oo-switch-captions-off': true,
      'oo-switch-captions-active': !this.props.closedCaptionOptions.enabled
    });

    var offString = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.OFF, this.props.localizableStrings);
    var onString = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.ON, this.props.localizableStrings);

    return (
      React.createElement("div", {className: "oo-switch-container"}, 
        React.createElement("span", {className: offCaptionClassName}, offString), 
        React.createElement("div", {className: "oo-switch-element"}, 
          React.createElement("span", {className: switchBodyClassName}), 
          React.createElement("span", {className: switchThumbClassName})
        ), 
        React.createElement("span", {className: onCaptionClassName}, onString), 
        React.createElement("a", {className: "oo-switch-container-selectable", onClick: this.handleOnOffSwitch})
      )
    );
  }
});

module.exports = OnOffSwitch;

},{"../../constants/constants":36,"./../utils":34,"classnames":51,"react":212}],14:[function(require,module,exports){
var React = require('react');

var SelectionContainer = React.createClass({displayName: "SelectionContainer",
  render: function() {
    return(
      React.createElement("div", {className: "oo-selection-container" + (this.props.className ? " " + this.props.className : "")}, 
        React.createElement("div", {className: "oo-selection-inner-wrapper"}, 
          React.createElement("div", {className: "oo-selection-container-title"}, 
            this.props.title, ": ", React.createElement("span", {className: "oo-selection-container-selection-text"}, this.props.selectionText)
          ), 
          React.createElement("div", {className: "oo-selection-items-container"}, 
            this.props.children
          )
        )
      )
    );
  }
});

module.exports = SelectionContainer;

},{"react":212}],15:[function(require,module,exports){
var React = require('react'),
    ClassNames = require('classnames'),
    Utils = require('../utils'),
    CONSTANTS = require('../../constants/constants'),
    SelectionContainer = require('./selectionContainer');

var TextEnhancementsTab = React.createClass({displayName: "TextEnhancementsTab",
  getInitialState: function() {
    return {
      selectedTextEnhancement: this.props.closedCaptionOptions.textEnhancement,
      textEnhancements: ["Uniform", "Depressed", "Raised", "Shadow"]
    };
  },

  changeTextEnhancement: function(textEnhancement) {
    if (!this.props.closedCaptionOptions.enabled) {
      this.props.controller.toggleClosedCaptionEnabled();
    }
    this.props.controller.onClosedCaptionChange('textEnhancement', textEnhancement);
    this.setState({
      selectedTextEnhancement: textEnhancement
    });
  },

  setClassname: function(item, elementType) {
    return ClassNames({
      'oo-text-enhancement-letter': elementType == "letter",
      'oo-text-enhancement-label': elementType == "label",
      'oo-text-enhancement-selected': this.props.closedCaptionOptions.textEnhancement == item && this.props.closedCaptionOptions.enabled,
      'oo-text-enhancement-label-selected': this.props.closedCaptionOptions.textEnhancement == item && this.props.closedCaptionOptions.enabled && elementType == "label",
      'oo-disabled': !this.props.closedCaptionOptions.enabled
    });
  },

  render: function() {
    var textEnhancementTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.TEXT_ENHANCEMENT, this.props.localizableStrings);
    var textEnhancementSelection = Utils.getLocalizedString(
      this.props.language,
      CONSTANTS.SKIN_TEXT[this.props.closedCaptionOptions.textEnhancement.toUpperCase()],
      this.props.localizableStrings
    );

    var textEnhancementItems = [];
    for(var i = 0; i < this.state.textEnhancements.length; i++) {
      textEnhancementItems.push(
        React.createElement("a", {className: "oo-text-enhancements-container", onClick: this.changeTextEnhancement.bind(this, this.state.textEnhancements[i]), key: i}, 
          React.createElement("div", {className: this.setClassname(this.state.textEnhancements[i], "letter") + " oo-text-enhancement-letter-" + this.state.textEnhancements[i]}, "A"), 
          React.createElement("div", {className: this.setClassname(this.state.textEnhancements[i], "label")}, 
            Utils.getLocalizedString(
              this.props.language,
              CONSTANTS.SKIN_TEXT[this.state.textEnhancements[i].toUpperCase()],
              this.props.localizableStrings
            )
          )
        )
      );
    }

    return (
      React.createElement("div", {className: "oo-text-enhancements-tab"}, 
        React.createElement("div", {className: "oo-text-enhancements-inner-wrapper"}, 
          React.createElement(SelectionContainer, {
            title: textEnhancementTitle, 
            selectionText: textEnhancementSelection
            }, 
            textEnhancementItems
          )
        )
      )
    );
  }
});

module.exports = TextEnhancementsTab;

},{"../../constants/constants":36,"../utils":34,"./selectionContainer":14,"classnames":51,"react":212}],16:[function(require,module,exports){
var React = require('react'),
    ClassNames = require('classnames');

var ColorSelector = React.createClass({displayName: "ColorSelector",
  setClassname: function(item){
    return ClassNames({
      'oo-item': true,
      'oo-item-selected': this.props.selectedColor == item && this.props.enabled,
      'oo-disabled': !this.props.enabled
    });
  },

  handleColorSelection: function(color) {
    this.props.onColorChange(color);
  },

  render: function() {
    var colorItems = [];
    for (var i = 0; i < this.props.colors.length; i++) {
      colorItems.push(
        React.createElement("div", {className: this.setClassname(this.props.colors[i]), key: i}, 
          React.createElement("a", {className: "oo-color-item oo-color-item-" + this.props.colors[i], onClick: this.handleColorSelection.bind(this, this.props.colors[i])})
        )
      );
    }

    return (
      React.createElement("div", {className: "oo-color-selector"}, 
        colorItems
      )
    );
  }
});

module.exports = ColorSelector;

},{"classnames":51,"react":212}],17:[function(require,module,exports){
/********************************************************************
  CONTROL BAR
*********************************************************************/
var React = require('react'),
    ReactDOM = require('react-dom'),
    CONSTANTS = require('../constants/constants'),
    ClassNames = require('classnames'),
    ScrubberBar = require('./scrubberBar'),
    Slider = require('./slider'),
    Utils = require('./utils'),
    Popover = require('../views/popover'),
    VideoQualityPanel = require('./videoQualityPanel'),
    ClosedCaptionPopover = require('./closed-caption/closedCaptionPopover'),
    Logo = require('./logo');
    Icon = require('./icon');

var ControlBar = React.createClass({displayName: "ControlBar",
  getInitialState: function() {
    this.isMobile = this.props.controller.state.isMobile;
    this.responsiveUIMultiple = this.getResponsiveUIMultiple(this.props.responsiveView);
    this.volumeSliderValue = 0;
    this.moreOptionsItems = null;

    return {
      currentVolumeHead: 0,
      showVideoQualityPopover: false,
      showClosedCaptionPopover: false
    };
  },

  componentWillReceiveProps: function(nextProps) {
    // if responsive breakpoint changes
    if (nextProps.responsiveView != this.props.responsiveView) {
      this.responsiveUIMultiple = this.getResponsiveUIMultiple(nextProps.responsiveView);
    }
  },

  componentWillUnmount: function () {
    this.props.controller.cancelTimer();
    if (Utils.isAndroid()){
      this.props.controller.hideVolumeSliderBar();
    }
  },

  getResponsiveUIMultiple: function(responsiveView){
    var multiplier = this.props.skinConfig.responsive.breakpoints[responsiveView].multiplier;
    return multiplier;
  },

  handleControlBarMouseUp: function(evt) {
    if (evt.type == 'touchend' || !this.isMobile){
      evt.stopPropagation(); // W3C
      evt.cancelBubble = true; // IE
      this.props.controller.state.accessibilityControlsEnabled = true;
      this.props.controller.startHideControlBarTimer();
    }
  },

  handleFullscreenClick: function(evt) {
    // On mobile, we get a following click event that fires after the Video
    // has gone full screen, clicking on a different UI element. So we prevent
    // the following click.
    evt.stopPropagation();
    evt.cancelBubble = true;
    evt.preventDefault();
    this.props.controller.toggleFullscreen();
  },

  handleLiveClick: function(evt) {
    evt.stopPropagation();
    evt.cancelBubble = true;
    evt.preventDefault();
    this.props.controller.onLiveClick();
    this.props.controller.seek(this.props.duration);
  },

  handleVolumeIconClick: function(evt) {
    if (this.isMobile){
      this.props.controller.startHideControlBarTimer();
      evt.stopPropagation(); // W3C
      evt.cancelBubble = true; // IE
      if (!this.props.controller.state.volumeState.volumeSliderVisible){
        this.props.controller.showVolumeSliderBar();
      }
      else {
        this.props.controller.handleMuteClick();
      }
    }
    else{
      this.props.controller.handleMuteClick();
    }
  },

  handlePlayClick: function() {
    this.props.controller.togglePlayPause();
  },

  handleShareClick: function() {
    this.props.controller.toggleShareScreen();
  },

  handleQualityClick: function() {
    if(this.props.responsiveView == this.props.skinConfig.responsive.breakpoints.xs.id) {
      this.props.controller.toggleScreen(CONSTANTS.SCREEN.VIDEO_QUALITY_SCREEN);
    } else {
      this.toggleQualityPopover();
      if(this.state.showClosedCaptionPopover == true) {
        this.toggleCaptionPopover();
      }
    }
  },

  toggleQualityPopover: function() {
    this.props.controller.toggleVideoQualityPopOver();
    this.setState({
      showVideoQualityPopover: this.props.controller.state.videoQualityOptions.showVideoQualityPopover
    });
  },

  toggleCaptionPopover: function() {
    this.props.controller.toggleClosedCaptionPopOver();
    this.setState({
      showClosedCaptionPopover: this.props.controller.state.closedCaptionOptions.showClosedCaptionPopover
    });
  },

  handleVolumeClick: function(evt) {
    evt.preventDefault();
    var newVolume = parseFloat(evt.target.dataset.volume);
    this.props.controller.setVolume(newVolume);
  },

  handleDiscoveryClick: function() {
    this.props.controller.toggleDiscoveryScreen();
  },

  handleMoreOptionsClick: function() {
    this.props.controller.toggleMoreOptionsScreen(this.moreOptionsItems);
  },

  handleClosedCaptionClick: function() {
    if(this.props.responsiveView == this.props.skinConfig.responsive.breakpoints.xs.id) {
      this.props.controller.toggleScreen(CONSTANTS.SCREEN.CLOSEDCAPTION_SCREEN);
    } else {
      this.toggleCaptionPopover();
      if(this.state.showVideoQualityPopover == true) {
        this.toggleQualityPopover();
      }
    }
  },

  //TODO(dustin) revisit this, doesn't feel like the "react" way to do this.
  highlight: function(evt) {
    var color = this.props.skinConfig.controlBar.iconStyle.active.color;
    var opacity = this.props.skinConfig.controlBar.iconStyle.active.opacity;
    Utils.highlight(evt.target, opacity, color);
  },

  removeHighlight: function(evt) {
    var color = this.props.skinConfig.controlBar.iconStyle.inactive.color;
    var opacity = this.props.skinConfig.controlBar.iconStyle.inactive.opacity;
    Utils.removeHighlight(evt.target, opacity, color);
  },

  volumeHighlight:function() {
    this.highlight({target: ReactDOM.findDOMNode(this.refs.volumeIcon)});
  },

  volumeRemoveHighlight:function() {
    this.removeHighlight({target: ReactDOM.findDOMNode(this.refs.volumeIcon)});
  },

  changeVolumeSlider: function(event) {
    var newVolume = parseFloat(event.target.value);
    this.props.controller.setVolume(newVolume);
    this.setState({
      volumeSliderValue: event.target.value
    });
  },

  populateControlBar: function() {
    var dynamicStyles = this.setupItemStyle();
    var playIcon = "";
    if (this.props.playerState == CONSTANTS.STATE.PLAYING) {
      playIcon = "pause";
    } else if (this.props.playerState == CONSTANTS.STATE.END) {
      playIcon = "replay";
    } else {
      playIcon = "play";
    }

    var volumeIcon = (this.props.controller.state.volumeState.muted ? "volumeOff" : "volume");

    var fullscreenIcon = "";
    if (this.props.controller.state.fullscreen) {
      fullscreenIcon = "compress"
    }
    else {
      fullscreenIcon = "expand";
    }

    var totalTime = 0;
    if (this.props.duration == null || typeof this.props.duration == 'undefined' || this.props.duration == ""){
      totalTime = Utils.formatSeconds(0);
    }
    else {
      totalTime = Utils.formatSeconds(this.props.duration);
    }

    var volumeBars = [];
    for (var i=0; i<10; i++) {
      //create each volume tick separately
      var turnedOn = this.props.controller.state.volumeState.volume >= (i+1) / 10;
      var volumeClass = ClassNames({
        "oo-volume-bar": true,
        "oo-on": turnedOn
      });
      var barStyle = turnedOn ? {backgroundColor: this.props.skinConfig.controlBar.volumeControl.color} : null;
      volumeBars.push(React.createElement("a", {"data-volume": (i+1)/10, className: volumeClass, key: i, 
        style: barStyle, 
        onClick: this.handleVolumeClick}));
    }

    var volumeSlider = React.createElement("div", {className: "oo-volume-slider"}, React.createElement(Slider, {value: parseFloat(this.props.controller.state.volumeState.volume), 
                        onChange: this.changeVolumeSlider, 
                        className: "oo-slider oo-slider-volume", 
                        itemRef: "volumeSlider", 
                        minValue: "0", 
                        maxValue: "1", 
                        step: "0.1"}));

    var volumeControls;
    if (!this.isMobile){
      volumeControls = volumeBars;
    }
    else {
      volumeControls = this.props.controller.state.volumeState.volumeSliderVisible ? volumeSlider : null;
    }

    var playheadTime = isFinite(parseInt(this.props.currentPlayhead)) ? Utils.formatSeconds(parseInt(this.props.currentPlayhead)) : null;
    var isLiveStream = this.props.isLiveStream;
    var durationSetting = {color: this.props.skinConfig.controlBar.iconStyle.inactive.color};
    var timeShift = this.props.currentPlayhead - this.props.duration;
    // checking timeShift < 1 seconds (not == 0) as processing of the click after we rewinded and then went live may take some time
    var isLiveNow = Math.abs(timeShift) < 1;
    var liveClick = isLiveNow ? null : this.handleLiveClick;
    var playheadTimeContent = isLiveStream ? (isLiveNow ? null : Utils.formatSeconds(timeShift)) : playheadTime;
    var totalTimeContent = isLiveStream ? null : React.createElement("span", {className: "oo-total-time"}, totalTime);

    // TODO: Update when implementing localization
    var liveText = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.LIVE, this.props.localizableStrings);

    var liveClass = ClassNames({
        "oo-control-bar-item oo-live oo-live-indicator": true,
        "oo-live-nonclickable": isLiveNow
      });

    var videoQualityPopover = this.props.controller.state.videoQualityOptions.showVideoQualityPopover ? React.createElement(Popover, null, React.createElement(VideoQualityPanel, React.__spread({}, this.props, {togglePopoverAction: this.toggleQualityPopover, popover: true}))) : null;
    var closedCaptionPopover = this.props.controller.state.closedCaptionOptions.showClosedCaptionPopover ? React.createElement(Popover, null, React.createElement(ClosedCaptionPopover, React.__spread({},  this.props, {togglePopoverAction: this.toggleCaptionPopover}))) : null;

    var qualityClass = ClassNames({
      "oo-quality": true,
      "oo-control-bar-item": true,
      "oo-selected": this.props.controller.state.videoQualityOptions.showVideoQualityPopover
    });

    var captionClass = ClassNames({
      "oo-closed-caption": true,
      "oo-control-bar-item": true,
      "oo-selected": this.props.controller.state.closedCaptionOptions.showClosedCaptionPopover
    });

    var controlItemTemplates = {
      "playPause": React.createElement("a", {className: "oo-play-pause oo-control-bar-item", onClick: this.handlePlayClick, key: "playPause"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: playIcon, 
          style: dynamicStyles.iconCharacter, 
          onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      ),

      "live": React.createElement("a", {className: liveClass, 
          ref: "LiveButton", 
          onClick: liveClick, key: "live"}, 
        React.createElement("div", {className: "oo-live-circle"}), 
        React.createElement("span", {className: "oo-live-text"}, liveText)
      ),

      "volume": React.createElement("div", {className: "oo-volume oo-control-bar-item", key: "volume"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: volumeIcon, ref: "volumeIcon", 
          style: this.props.skinConfig.controlBar.iconStyle.inactive, 
          onClick: this.handleVolumeIconClick, 
          onMouseOver: this.volumeHighlight, onMouseOut: this.volumeRemoveHighlight})), 
        volumeControls
      ),

      "timeDuration": React.createElement("a", {className: "oo-time-duration oo-control-bar-duration", style: durationSetting, key: "timeDuration"}, 
        React.createElement("span", null, playheadTimeContent), totalTimeContent
      ),

      "flexibleSpace": React.createElement("div", {className: "oo-flexible-space oo-control-bar-flex-space", key: "flexibleSpace"}),

      "moreOptions": React.createElement("a", {className: "oo-more-options oo-control-bar-item", 
        onClick: this.handleMoreOptionsClick, key: "moreOptions"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: "ellipsis", style: dynamicStyles.iconCharacter, 
          onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      ),

      "quality": (
        React.createElement("div", {className: "oo-popover-button-container", key: "quality"}, 
          videoQualityPopover, 
          React.createElement("a", {className: qualityClass, onClick: this.handleQualityClick}, 
            React.createElement(Icon, React.__spread({},  this.props, {icon: "quality", style: dynamicStyles.iconCharacter, 
              onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
          )
        )
      ),

      "discovery": React.createElement("a", {className: "oo-discovery oo-control-bar-item", 
        onClick: this.handleDiscoveryClick, key: "discovery"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: "discovery", style: dynamicStyles.iconCharacter, 
          onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      ),

      "closedCaption": (
        React.createElement("div", {className: "oo-popover-button-container", key: "closedCaption"}, 
          closedCaptionPopover, 
          React.createElement("a", {className: captionClass, onClick: this.handleClosedCaptionClick}, 
            React.createElement(Icon, React.__spread({},  this.props, {icon: "cc", style: dynamicStyles.iconCharacter, 
              onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
          )
        )
      ),

      "share": React.createElement("a", {className: "oo-share oo-control-bar-item", 
        onClick: this.handleShareClick, key: "share"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: "share", style: dynamicStyles.iconCharacter, 
          onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      ),

      "fullscreen": React.createElement("a", {className: "oo-fullscreen oo-control-bar-item", 
        onClick: this.handleFullscreenClick, key: "fullscreen"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: fullscreenIcon, style: dynamicStyles.iconCharacter, 
          onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      ),

      "logo": React.createElement(Logo, {key: "logo", imageUrl: this.props.skinConfig.controlBar.logo.imageResource.url, 
                    clickUrl: this.props.skinConfig.controlBar.logo.clickUrl, 
                    target: this.props.skinConfig.controlBar.logo.target, 
                    width: this.props.responsiveView != this.props.skinConfig.responsive.breakpoints.xs.id ? this.props.skinConfig.controlBar.logo.width : null, 
                    height: this.props.skinConfig.controlBar.logo.height})
    };

    var controlBarItems = [];
    var defaultItems = this.props.controller.state.isPlayingAd ? this.props.skinConfig.buttons.desktopAd : this.props.skinConfig.buttons.desktopContent;

    //if mobile and not showing the slider or the icon, extra space can be added to control bar width. If volume bar is shown instead of slider, add some space as well:
    var volumeItem = null;
    var extraSpaceVolume = 0;

    for (var j = 0; j < defaultItems.length; j++) {
      if (defaultItems[j].name == "volume") {
        volumeItem = defaultItems[j];

        var extraSpaceVolumeSlider = (((volumeItem && this.isMobile && !this.props.controller.state.volumeState.volumeSliderVisible) || volumeItem && Utils.isIos()) ? parseInt(volumeItem.minWidth) : 0);
        var extraSpaceVolumeBar = this.isMobile ? 0 : parseInt(volumeItem.minWidth)/2;
        extraSpaceVolume = extraSpaceVolumeSlider + extraSpaceVolumeBar;

        break;
      }
    }


    //if no hours, add extra space to control bar width:
    var hours = parseInt(this.props.duration / 3600, 10);
    var extraSpaceDuration = (hours > 0) ? 0 : 45;

    var controlBarLeftRightPadding = CONSTANTS.UI.DEFAULT_SCRUBBERBAR_LEFT_RIGHT_PADDING * 2;

    for (var k = 0; k < defaultItems.length; k++) {

      // filter out unrecognized button names
      if (typeof controlItemTemplates[defaultItems[k].name] === "undefined") {
        continue;
      }

      //do not show CC button if no CC available
      if (!this.props.controller.state.closedCaptionOptions.availableLanguages && (defaultItems[k].name === "closedCaption")){
        continue;
      }

      //do not show quality button if no bitrates available
      if (!this.props.controller.state.videoQualityOptions.availableBitrates && (defaultItems[k].name === "quality")){
        continue;
      }

      //do not show discovery button if no related videos available
      if (!this.props.controller.state.discoveryData && (defaultItems[k].name === "discovery")){
        continue;
      }

      //do not show logo if no image url available
      if (!this.props.skinConfig.controlBar.logo.imageResource.url && (defaultItems[k].name === "logo")){
        continue;
      }

      if (Utils.isIos() && (defaultItems[k].name === "volume")){
        continue;
      }

      // Not sure what to do when there are multi streams
      if (defaultItems[k].name === "live" &&
          (typeof this.props.isLiveStream === 'undefined' ||
          !(this.props.isLiveStream))) {
        continue;
      }

      controlBarItems.push(defaultItems[k]);
    }

    var collapsedResult = Utils.collapse(this.props.componentWidth + this.responsiveUIMultiple * (extraSpaceDuration + extraSpaceVolume - controlBarLeftRightPadding), controlBarItems, this.responsiveUIMultiple);
    var collapsedControlBarItems = collapsedResult.fit;
    var collapsedMoreOptionsItems = collapsedResult.overflow;
    this.moreOptionsItems = collapsedMoreOptionsItems;

    finalControlBarItems = [];

    for (var k = 0; k < collapsedControlBarItems.length; k++) {
      if (collapsedControlBarItems[k].name === "moreOptions" && collapsedMoreOptionsItems.length === 0) {
        continue;
      }

      finalControlBarItems.push(controlItemTemplates[collapsedControlBarItems[k].name]);
    }

    return finalControlBarItems;
  },

  setupItemStyle: function() {
    var returnStyles = {};

    returnStyles.iconCharacter = {
      color: this.props.skinConfig.controlBar.iconStyle.inactive.color,
      opacity: this.props.skinConfig.controlBar.iconStyle.inactive.opacity

    };
    return returnStyles;
  },


  render: function() {
    var controlBarClass = ClassNames({
      "oo-control-bar": true,
      "oo-control-bar-hidden": !this.props.controlBarVisible
    });

    var controlBarItems = this.populateControlBar();

    var controlBarStyle = {
      height: this.props.skinConfig.controlBar.height
    };

    return (
      React.createElement("div", {className: controlBarClass, style: controlBarStyle, onMouseUp: this.handleControlBarMouseUp, onTouchEnd: this.handleControlBarMouseUp}, 
        React.createElement(ScrubberBar, React.__spread({},  this.props)), 

        React.createElement("div", {className: "oo-control-bar-items-wrapper"}, 
          controlBarItems
        )
      )
    );
  }
});

ControlBar.defaultProps = {
  isLiveStream: false,
  skinConfig: {
    responsive: {
      breakpoints: {
        xs: {id: 'xs'},
        sm: {id: 'sm'},
        md: {id: 'md'},
        lg: {id: 'lg'}
      }
    }
  },
  responsiveView: 'md'
};

module.exports = ControlBar;

},{"../constants/constants":36,"../views/popover":49,"./closed-caption/closedCaptionPopover":8,"./icon":22,"./logo":23,"./scrubberBar":25,"./slider":27,"./utils":34,"./videoQualityPanel":35,"classnames":51,"react":212,"react-dom":55}],18:[function(require,module,exports){
/********************************************************************
  COUNT DOWN CLOCK
*********************************************************************/
/**
*
*
* @class CountDownClock
* @constructor
*/
var React = require('react'),
    ReactDOM = require('react-dom'),
    ClassNames = require('classnames'),
    CONSTANTS = require('../constants/constants');

var CountDownClock = React.createClass({displayName: "CountDownClock",
  getInitialState: function() {
    // canvas, interval, and context are changing based on time instead of user interaction
    this.canvas = null;
    this.context = null;
    this.interval = null;
    var tmpFraction = 0;
    var tmpRemainSeconds = 0;
    var upNextTimeToShow = parseInt(this.props.controller.state.upNextInfo.timeToShow);

    if(this.props.controller.state.screenToShow === CONSTANTS.SCREEN.DISCOVERY_SCREEN) {
      tmpFraction = 2 / this.props.timeToShow;
      tmpRemainSeconds = this.props.timeToShow;
    }
    else {
      tmpFraction = 2 / upNextTimeToShow;
      tmpRemainSeconds = this.props.duration - this.props.currentPlayhead;
    }

    return {
      counterInterval: 0.05,
      fraction: tmpFraction, // fraction = 2 / (skinConfig.upNext.timeToShow) so "fraction * pi" is how much we want to fill the circle for each second
      remainSeconds: tmpRemainSeconds,
      hideClock: false
    };
  },

  handleClick: function(event) {
    if (event.type == 'touchend' || !this.isMobile){
      //since mobile would fire both click and touched events,
      //we need to make sure only one actually does the work

      if(this.props.controller.state.screenToShow === CONSTANTS.SCREEN.DISCOVERY_SCREEN) {
        this.setState({hideClock: true});
        clearInterval(this.interval);
      }
    }
  },

  componentWillMount: function() {
    this.updateClockSize();
  },

  componentDidMount: function() {
    this.setupCountDownTimer();
  },

  componentWillUnmount: function() {
    clearInterval(this.interval);
  },

  setupCountDownTimer: function() {
    this.setupCanvas();
    this.drawBackground();
    this.drawTimer();
    this.startTimer();
  },

  setupCanvas: function() {
    this.canvas = ReactDOM.findDOMNode(this);
    this.context = this.canvas.getContext("2d");
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.font = "regular 12px Arial";
  },

  drawBackground: function() {
    this.context.beginPath();
    this.context.globalAlpha = 1;
    this.context.fillStyle = 'gray';
    this.context.arc(this.state.clockContainerWidth / 2, this.state.clockRadius, this.state.clockRadius, 0, Math.PI * 2, false);
    this.context.arc(this.state.clockContainerWidth / 2, this.state.clockRadius, this.state.clockRadius / 1.2, Math.PI * 2, 0, true);
    this.context.fill();
  },

  updateClockSize: function(){
    if (this.props.controller.state.screenToShow === CONSTANTS.SCREEN.DISCOVERY_SCREEN){
      var clockWidth = 75;
    }
    else {
      var clockWidth = this.props.responsiveView == this.props.skinConfig.responsive.breakpoints.xs.id ? 25 : 36;
    }
    this.setState({
      clockRadius: parseInt(clockWidth, 10)/2,
      clockContainerWidth: parseInt(clockWidth, 10)
    });
  },

  drawTimer: function() {
    var decimals;
    var percent = this.state.fraction * this.state.remainSeconds + 1.5;
    this.context.fillStyle = 'white';
    if(this.props.controller.state.screenToShow === CONSTANTS.SCREEN.PLAYING_SCREEN || this.props.controller.state.screenToShow === CONSTANTS.SCREEN.PAUSE_SCREEN) {
      this.context.fillText(this.state.remainSeconds.toFixed(decimals), this.state.clockContainerWidth / 2, this.state.clockRadius, 100);
    }
    this.context.beginPath();
    this.context.arc(this.state.clockContainerWidth / 2, this.state.clockRadius, this.state.clockRadius, Math.PI * 1.5, Math.PI * percent, false);
    this.context.arc(this.state.clockContainerWidth / 2, this.state.clockRadius, this.state.clockRadius / 1.2, Math.PI * percent, Math.PI * 1.5, true);
    this.context.fill();
  },

  startTimer: function() {
    this.interval = setInterval(this.tick, this.state.counterInterval * 1000);
  },

  tick: function() {
    if(this.props.controller.state.screenToShow === CONSTANTS.SCREEN.DISCOVERY_SCREEN) {
      if(this.state.remainSeconds < 1) {
        this.setState({remainSeconds: 0});
        clearInterval(this.interval);
        this.startDiscoveryVideo();
      }
      else {
        this.setState({remainSeconds: this.state.remainSeconds-(this.state.counterInterval)});
        this.updateCanvas();
      }
    }
    else if(this.props.controller.state.screenToShow === CONSTANTS.SCREEN.PLAYING_SCREEN || this.props.controller.state.screenToShow === CONSTANTS.SCREEN.PAUSE_SCREEN) {
      if (this.state.remainSeconds < 1 || this.props.playerState === CONSTANTS.STATE.END) {
        this.setState({remainSeconds: 0});
        clearInterval(this.interval);
        this.startUpNextVideo();
      }
      else {
        this.setState({remainSeconds: this.props.duration - this.props.currentPlayhead});
        this.updateCanvas();
      }
    }
  },

  updateCanvas: function() {
    this.clearCanvas();
    this.drawTimer();
  },

  clearCanvas: function() {
    this.context = this.canvas.getContext("2d");
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackground();
  },

  startDiscoveryVideo: function() {
    var eventData = {
          "clickedVideo" : this.props.discoveryData.relatedVideos[0],
          "custom" : this.props.discoveryData.custom
        };
    this.props.controller.sendDiscoveryClickEvent(eventData, false);
  },

  startUpNextVideo: function() {
    OO.log("startUpNext");
    var eventData = {
      "clickedVideo" : this.props.upNextInfo.upNextData,
      "custom" : {"source": CONSTANTS.SCREEN.UP_NEXT_SCREEN}
    };
    this.props.controller.sendDiscoveryClickEvent(eventData, true);
  },

  render: function() {
    var canvasClassName = ClassNames({
      'oo-countdown-clock': true,
      'oo-up-next-count-down': this.props.controller.state.screenToShow !== CONSTANTS.SCREEN.DISCOVERY_SCREEN,
      'oo-discovery-count-down': this.props.controller.state.screenToShow === CONSTANTS.SCREEN.DISCOVERY_SCREEN,
      'oo-hidden': this.state.hideClock
    });

    return (
      React.createElement("canvas", {className: canvasClassName, 
              width: this.state.clockContainerWidth, 
              height: this.state.clockContainerWidth, 
              onClick: this.handleClick, 
              onTouchEnd: this.handleClick}
      )
    );
  }
});

CountDownClock.propTypes = {
  timeToShow: React.PropTypes.string,
  clockWidth: React.PropTypes.number,
  currentPlayhead: React.PropTypes.number
};

CountDownClock.defaultProps = {
  timeToShow: "10", //seconds
  clockWidth: 36,
  currentPlayhead: 0
};

module.exports = CountDownClock;

},{"../constants/constants":36,"classnames":51,"react":212,"react-dom":55}],19:[function(require,module,exports){
var React = require('react'),
    ClassNames = require('classnames'),
    Icon = require('./icon');

var DataSelector = React.createClass({displayName: "DataSelector",
  getInitialState: function() {
    return {
      currentPage: 1
    };
  },

  handleDataSelection: function(dataItem) {
    this.props.onDataChange(dataItem);
  },

  handleLeftChevronClick: function(event) {
    event.preventDefault();
    this.setState({
      currentPage: this.state.currentPage - 1
    });
  },

  handleRightChevronClick: function(event) {
    event.preventDefault();
    this.setState({
      currentPage: this.state.currentPage + 1
    });
  },

  componentWillReceiveProps: function(nextProps) {
    //If we are changing view sizes, adjust the currentPage number to reflect the new number of items per page.
    if (nextProps.responsiveView != this.props.viewSize) {
      var currentViewSize = this.props.viewSize;
      var nextViewSize = nextProps.responsiveView;
      var firstDataIndex = this.state.currentPage * this.props.dataItemsPerPage[currentViewSize] - this.props.dataItemsPerPage[currentViewSize];
      var newCurrentPage = Math.floor(firstDataIndex/nextProps.dataItemsPerPage[nextViewSize]) + 1;
      this.setState({
        currentPage: newCurrentPage
      });
    }
  },

  setClassname: function(item) {
    return ClassNames({
      'oo-item': true,
      'oo-item-selected': this.props.selectedData == item && this.props.enabled,
      'oo-disabled': !this.props.enabled
    });
  },

  render: function() {
    //pagination
    var currentViewSize = this.props.viewSize;
    var dataItemsPerPage = this.props.dataItemsPerPage[currentViewSize];
    var startAt = dataItemsPerPage * (this.state.currentPage - 1);
    var endAt = dataItemsPerPage * this.state.currentPage;
    var dataItems = this.props.availableDataItems.slice(startAt, endAt);

    //Build data content blocks
    var dataContentBlocks = [];
    for (var i = 0; i < dataItems.length; i++) {
      dataContentBlocks.push(
        React.createElement("a", {className: this.setClassname(dataItems[i]), onClick: this.handleDataSelection.bind(this, dataItems[i]), key: i}, 
          React.createElement("span", {className: "oo-data"}, dataItems[i])
        )
      );
    }

    var leftChevron = ClassNames({
      'oo-left-button': true,
      'oo-hidden': !this.props.enabled || this.state.currentPage <= 1
    });
    var rightChevron = ClassNames({
      'oo-right-button': true,
      'oo-hidden': !this.props.enabled || endAt >= this.props.availableDataItems.length
    });

    return(
      React.createElement("div", {className: "oo-data-selector"}, 
        React.createElement("div", {className: "oo-data-panel oo-flexcontainer"}, 
          dataContentBlocks
        ), 

        React.createElement("a", {className: leftChevron, ref: "leftChevron", onClick: this.handleLeftChevronClick}, 
          React.createElement(Icon, React.__spread({}, 
            this.props, 
            {icon: "left"})
          )
        ), 
        React.createElement("a", {className: rightChevron, ref: "rightChevron", onClick: this.handleRightChevronClick}, 
          React.createElement(Icon, React.__spread({}, 
            this.props, 
            {icon: "right"})
          )
        )
      )
    );
  }
});

module.exports = DataSelector;

},{"./icon":22,"classnames":51,"react":212}],20:[function(require,module,exports){
var React = require('react');

var DiscoverItem = React.createClass({displayName: "DiscoverItem",
  getInitialState: function() {
    return {
      imgError: false
    };
  },

  componentWillMount: function() {
    var img = new Image();
    img.src = this.props.src;

    // check if error occurs while loading img
    img.onerror = function() {
      this.setState({
        imgError: true
      });
    }.bind(this);
  },

  render: function() {
    // handle img error, return null
    if (this.state.imgError) {
      return null;
    }

    var thumbnailStyle = {
      backgroundImage: "url('" + this.props.src + "')"
    };

    return (
      React.createElement("div", {className: "oo-discovery-image-wrapper-style"}, 
        React.createElement("div", {className: "oo-discovery-wrapper"}, 
          React.createElement("a", {onClick: this.props.onClickAction}, 
            React.createElement("div", {className: "oo-image-style", style: thumbnailStyle})
          ), 
          this.props.children
        ), 
        React.createElement("div", {className: this.props.contentTitleClassName, dangerouslySetInnerHTML: "<div>test</div>" })
      )
    );
  }
});
module.exports = DiscoverItem;

},{"react":212}],21:[function(require,module,exports){
/**
 * Panel component for Discovery Screen
 *
 * @module DiscoveryPanel
 */
var React = require('react'),
    ReactDOM = require('react-dom'),
    ClassNames = require('classnames'),
    CONSTANTS = require('../constants/constants'),
    CountDownClock = require('./countDownClock'),
    DiscoverItem = require('./discoverItem'),
    ResizeMixin = require('../mixins/resizeMixin'),
    Icon = require('../components/icon');

var DiscoveryPanel = React.createClass({displayName: "DiscoveryPanel",
  mixins: [ResizeMixin],

  getInitialState: function() {
    return {
      showDiscoveryCountDown: this.props.skinConfig.discoveryScreen.showCountDownTimerOnEndScreen,
      currentPage: 1,
      componentHeight: null
    };
  },

  componentDidMount: function () {
    this.detectHeight();
  },

  handleResize: function(nextProps) {
    //If we are changing view sizes, adjust the currentPage number to reflect the new number of items per page.
    var currentViewSize = this.props.responsiveView;
    var nextViewSize = nextProps.responsiveView;
    var firstDiscoverIndex = this.state.currentPage * this.props.videosPerPage[currentViewSize] - this.props.videosPerPage[currentViewSize];
    var newCurrentPage = Math.floor(firstDiscoverIndex/nextProps.videosPerPage[nextViewSize]) + 1;
    this.setState({
      currentPage: newCurrentPage
    });
    this.detectHeight();
  },

  handleLeftButtonClick: function(event) {
    event.preventDefault();
    this.setState({
      currentPage: this.state.currentPage - 1
    });
  },

  handleRightButtonClick: function(event) {
    event.preventDefault();
    this.setState({
      currentPage: this.state.currentPage + 1
    });
  },

  handleDiscoveryContentClick: function(index) {
    var eventData = {
      "clickedVideo": this.props.discoveryData.relatedVideos[index],
      "custom": this.props.discoveryData.custom
    };
    // TODO: figure out countdown value
    // eventData.custom.countdown = 0;
    this.props.controller.sendDiscoveryClickEvent(eventData, false);
  },

  shouldShowCountdownTimer: function() {
    return this.state.showDiscoveryCountDown && this.props.playerState === CONSTANTS.STATE.END;
  },

  handleDiscoveryCountDownClick: function(event) {
    event.preventDefault();
    this.setState({
      showDiscoveryCountDown: false
    });
    this.refs.CountDownClock.handleClick(event);
  },

  // detect height of component
  detectHeight: function() {
    var discoveryPanel = ReactDOM.findDOMNode(this.refs.discoveryPanel);
    this.setState({
      componentHeight: discoveryPanel.getBoundingClientRect().height
    });
  },

  render: function() {
    var relatedVideos = this.props.discoveryData.relatedVideos;

    // if no discovery data render message
    if (relatedVideos.length < 1) {
      // TODO: get msg if no discovery related videos
    }

    //pagination
    var currentViewSize = this.props.responsiveView;
    var videosPerPage = this.props.videosPerPage[currentViewSize];
    var startAt = videosPerPage * (this.state.currentPage - 1);
    var endAt = videosPerPage * this.state.currentPage;
    var relatedVideoPage = relatedVideos.slice(startAt, endAt);

    // discovery content
    var discoveryContentName = ClassNames({
      'oo-discovery-content-name': true,
      'oo-hidden': !this.props.skinConfig.discoveryScreen.contentTitle.show
    });
    var discoveryCountDownWrapperStyle = ClassNames({
      'oo-discovery-count-down-wrapper-style': true,
      'oo-hidden': !this.state.showDiscoveryCountDown
    });
    var discoveryToaster = ClassNames({
      'oo-discovery-toaster-container-style': true,
      'oo-flexcontainer': true,
      'oo-scale-size': (this.props.responsiveView == this.props.skinConfig.responsive.breakpoints.xs.id && (this.props.componentWidth <= 420 || this.state.componentHeight <= 175)) || (this.props.responsiveView == this.props.skinConfig.responsive.breakpoints.sm.id && (this.props.componentWidth <= 420 || this.state.componentHeight <= 320))
    });
    var leftButtonClass = ClassNames({
      'oo-left-button': true,
      'oo-hidden': this.state.currentPage <= 1
    });
    var rightButtonClass = ClassNames({
      'oo-right-button': true,
      'oo-hidden': endAt >= relatedVideos.length
    });
    var countDownClock = (
      React.createElement("div", {className: discoveryCountDownWrapperStyle}, 
        React.createElement("a", {className: "oo-discovery-count-down-icon-style", onClick: this.handleDiscoveryCountDownClick}, 
          React.createElement(CountDownClock, React.__spread({},  this.props, {timeToShow: this.props.skinConfig.discoveryScreen.countDownTime, 
          ref: "CountDownClock"})), 
          React.createElement(Icon, React.__spread({},  this.props, {icon: "pause"}))
        )
      )
    );

    // Build discovery content blocks
    var discoveryContentBlocks = [];
    for (var i = 0; i < relatedVideoPage.length; i++) {
      discoveryContentBlocks.push(
        React.createElement(DiscoverItem, React.__spread({},  this.props, 
          {key: i, 
          src: relatedVideoPage[i].preview_image_url, 
          contentTitle: relatedVideoPage[i].name, 
          contentTitleClassName: discoveryContentName, 
          onClickAction: this.handleDiscoveryContentClick.bind(this, videosPerPage * (this.state.currentPage - 1) + i)
        }), 
          (this.shouldShowCountdownTimer() && i === 0) ? countDownClock : null
        )
      );
    }

    return (
      React.createElement("div", {className: "oo-content-panel oo-discovery-panel", ref: "discoveryPanel"}, 
        React.createElement("div", {className: discoveryToaster, id: "DiscoveryToasterContainer", ref: "DiscoveryToasterContainer"}, 
          discoveryContentBlocks
        ), 

        React.createElement("a", {className: leftButtonClass, ref: "ChevronLeftButton", onClick: this.handleLeftButtonClick}, 
          React.createElement(Icon, React.__spread({},  this.props, {icon: "left"}))
        ), 
        React.createElement("a", {className: rightButtonClass, ref: "ChevronRightButton", onClick: this.handleRightButtonClick}, 
          React.createElement(Icon, React.__spread({},  this.props, {icon: "right"}))
        )
      )
    );
  }
});

DiscoveryPanel.propTypes = {
  responsiveView: React.PropTypes.string,
  videosPerPage: React.PropTypes.objectOf(React.PropTypes.number),
  discoveryData: React.PropTypes.shape({
    relatedVideos: React.PropTypes.arrayOf(React.PropTypes.shape({
      preview_image_url: React.PropTypes.string,
      name: React.PropTypes.string
    }))
  }),
  skinConfig: React.PropTypes.shape({
    discoveryScreen: React.PropTypes.shape({
      showCountDownTimerOnEndScreen: React.PropTypes.bool,
      countDownTime: React.PropTypes.string,
      contentTitle: React.PropTypes.shape({
        show: React.PropTypes.bool
      })
    }),
    icons: React.PropTypes.objectOf(React.PropTypes.object)
  }),
  controller: React.PropTypes.shape({
    sendDiscoveryClickEvent: React.PropTypes.func
  })
};

DiscoveryPanel.defaultProps = {
  videosPerPage: {
    xs: 2,
    sm: 4,
    md: 6,
    lg: 8
  },
  skinConfig: {
    discoveryScreen: {
      showCountDownTimerOnEndScreen: true,
      countDownTime: "10",
      contentTitle: {
        show: true
      }
    },
    icons: {
      pause:{fontStyleClass:'oo-icon oo-icon-pause'},
      discovery:{fontStyleClass:'oo-icon oo-icon-topmenu-discovery'},
      left:{fontStyleClass:'oo-icon oo-icon-left'},
      right:{fontStyleClass:'oo-icon oo-icon-right'}
    },
    responsive: {
      breakpoints: {
        xs: {id: 'xs'},
        sm: {id: 'sm'},
        md: {id: 'md'},
        lg: {id: 'lg'}
      }
    }
  },
  discoveryData: {
    relatedVideos: []
  },
  controller: {
    sendDiscoveryClickEvent: function(a,b){}
  },
  responsiveView: 'md'
};

module.exports = DiscoveryPanel;

},{"../components/icon":22,"../constants/constants":36,"../mixins/resizeMixin":40,"./countDownClock":18,"./discoverItem":20,"classnames":51,"react":212,"react-dom":55}],22:[function(require,module,exports){
var React = require('react'),
    Utils = require('./utils');


var Icon = React.createClass({displayName: "Icon",
  shouldComponentUpdate: function(nextProps, nextState) {
    return  (nextProps.icon != this.props.icon);
  },

  render: function() {
    var iconStyle = Utils.extend({fontFamily: this.props.skinConfig.icons[this.props.icon].fontFamilyName}, this.props.style);
    return (
      React.createElement("span", {
        className: this.props.skinConfig.icons[this.props.icon].fontStyleClass + " " + this.props.className, 
        style: iconStyle, 
        onMouseOver: this.props.onMouseOver, onMouseOut: this.props.onMouseOut, 
        onClick: this.props.onClick}, 
        this.props.skinConfig.icons[this.props.icon].fontString
      )
    );
  }
});

Icon.propTypes = {
  icon: React.PropTypes.string,
  skinConfig: React.PropTypes.object,
  className: React.PropTypes.string,
  style: React.PropTypes.object
};

Icon.defaultProps = {
  icon: "",
  skinConfig: {},
  className: "",
  style: {}
};

module.exports = Icon;

},{"./utils":34,"react":212}],23:[function(require,module,exports){
var React = require('react');

var Logo = React.createClass({displayName: "Logo",
  render: function() {
    var content = this.props.clickUrl ?
      (React.createElement("a", {href: this.props.clickUrl, target: this.props.target}, 
        React.createElement("img", {width: this.props.width, height: this.props.height, src: this.props.imageUrl})
      )) :
      // if no link just show img
      React.createElement("img", {width: this.props.width, height: this.props.height, src: this.props.imageUrl});

    return (
      React.createElement("div", {className: "oo-logo oo-control-bar-item", style: this.props.style}, 
        content
      )
    );
  }
});

Logo.propTypes = {
  imageUrl: React.PropTypes.string.isRequired,
  clickUrl: React.PropTypes.string,
  target: React.PropTypes.string,
  width: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number
  ]),
  height: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number
  ]),
  style: React.PropTypes.object
};

Logo.defaultProps = {
  imageUrl: '/assets/images/ooyala.png',
  clickUrl: '',
  target: '_blank',
  width: null,
  height: null,
  style: {}
};

module.exports = Logo;

},{"react":212}],24:[function(require,module,exports){
/********************************************************************
 MORE OPTIONS PANEL
 *********************************************************************/
/**
 * @class MoreOptionsPanel
 * @constructor
 */
var React = require('react'),
    Utils = require('./utils'),
    CONSTANTS = require('../constants/constants'),
    ClassNames = require('classnames'),
    AnimateMixin = require('../mixins/animateMixin'),
    Icon = require('../components/icon');

var MoreOptionsPanel = React.createClass({displayName: "MoreOptionsPanel",
  mixins: [AnimateMixin],

  handleShareClick: function () {
    this.props.controller.toggleShareScreen();
  },

  handleQualityClick: function() {
    this.props.controller.toggleScreen(CONSTANTS.SCREEN.VIDEO_QUALITY_SCREEN);
  },

  handleDiscoveryClick: function () {
    this.props.controller.toggleDiscoveryScreen();
  },

  handleClosedCaptionClick: function () {
    this.props.controller.toggleScreen(CONSTANTS.SCREEN.CLOSEDCAPTION_SCREEN);
  },

  highlight: function (evt) {
    var color = this.props.skinConfig.moreOptionsScreen.iconStyle.active.color;
    var opacity = this.props.skinConfig.moreOptionsScreen.iconStyle.active.opacity;
    Utils.highlight(evt.target, opacity, color);
  },

  removeHighlight: function (evt) {
    var color = this.props.skinConfig.moreOptionsScreen.iconStyle.inactive.color;
    var opacity = this.props.skinConfig.moreOptionsScreen.iconStyle.inactive.opacity;
    Utils.removeHighlight(evt.target, opacity, color);
  },

  buildMoreOptionsButtonList: function () {
    //inline style for config/skin.json elements only
    var buttonStyle = {
      fontSize: this.props.skinConfig.moreOptionsScreen.iconSize + "px",
      color: this.props.skinConfig.moreOptionsScreen.iconStyle.inactive.color,
      opacity: this.props.skinConfig.moreOptionsScreen.iconStyle.inactive.opacity
    };

    var optionsItemsTemplates = {
      "quality": React.createElement("a", {className: "oo-quality oo-control-bar-item", onClick: this.handleQualityClick, key: "quality"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: "quality", style: buttonStyle, 
         onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      ),

      "discovery": React.createElement("a", {className: "oo-discovery oo-control-bar-item", onClick: this.handleDiscoveryClick, key: "discovery"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: "discovery", style: buttonStyle, 
          onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      ),

      "closedCaption": React.createElement("a", {className: "oo-closed-caption oo-control-bar-item", onClick: this.handleClosedCaptionClick, key: "closedCaption"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: "cc", style: buttonStyle, 
          onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      ),

      "share": React.createElement("a", {className: "oo-share oo-control-bar-item", onClick: this.handleShareClick, key: "share"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: "share", style: buttonStyle, 
          onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      ),

      "settings": React.createElement("div", {className: "oo-settings", key: "settings"}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: "setting", style: buttonStyle, 
          onMouseOver: this.highlight, onMouseOut: this.removeHighlight}))
      )
    };

    var items = this.props.controller.state.moreOptionsItems;
    var moreOptionsItems = [];
    
    for (var i = 0; i < items.length; i++) {
      moreOptionsItems.push(optionsItemsTemplates[items[i].name]);
    }

    return moreOptionsItems;
  },

  render: function () {
    var moreOptionsItemsClass = ClassNames({
      'oo-more-options-items': true,
      'oo-animate-more-options': this.state.animate
    });

    var moreOptionsItems = this.buildMoreOptionsButtonList();

    return (
      React.createElement("div", {className: "oo-content-panel oo-more-options-panel"}, 
        React.createElement("div", {className: moreOptionsItemsClass}, 
          moreOptionsItems
        )
      )
    );
  }
});

MoreOptionsPanel.defaultProps = {
  skinConfig: {
    moreOptionsScreen: {
      iconStyle: {
        active: {
          color: '#FFF',
          opacity: 1

        },
        inactive: {
          color: '#FFF',
          opacity: 0.6
        }
      }
    }
  }
};

module.exports = MoreOptionsPanel;

},{"../components/icon":22,"../constants/constants":36,"../mixins/animateMixin":39,"./utils":34,"classnames":51,"react":212}],25:[function(require,module,exports){
/********************************************************************
  SCRUBBER BAR
*********************************************************************/
var React = require('react'),
    ReactDOM = require('react-dom'),
    ResizeMixin = require('../mixins/resizeMixin'),
    Thumbnail = require('./thumbnail'),
    ThumbnailCarousel = require('./thumbnailCarousel'),
    CONSTANTS = require('../constants/constants');

var ScrubberBar = React.createClass({displayName: "ScrubberBar",
  mixins: [ResizeMixin],

  getInitialState: function() {
    this.lastScrubX = null;
    this.touchInitiated = false;

    return {
      scrubberBarWidth: 0,
      playheadWidth: 0,
      scrubbingPlayheadX: 0,
      hoveringX: 0,
      currentPlayhead: 0,
      transitionedDuringSeek: false
    };
  },

  componentWillMount: function() {
    if (this.props.seeking) {
      this.setState({transitionedDuringSeek: true});
    }
  },

  componentDidMount: function() {
    this.handleResize();
  },

  componentWillReceiveProps: function(nextProps) {
    if (this.transitionedDuringSeek && !nextProps.seeking) {
      this.setState({transitionedDuringSeek: false});
    }
  },

  componentWillUnmount: function() {
    if (!this.isMobile){
      ReactDOM.findDOMNode(this).parentNode.removeEventListener("mousemove", this.handlePlayheadMouseMove);
      document.removeEventListener("mouseup", this.handlePlayheadMouseUp, true);
    }
    else{
      ReactDOM.findDOMNode(this).parentNode.removeEventListener("touchmove", this.handlePlayheadMouseMove);
      document.removeEventListener("touchend", this.handlePlayheadMouseUp, true);
    }
  },

  getResponsiveUIMultiple: function(responsiveView){
    var multiplier = this.props.skinConfig.responsive.breakpoints[responsiveView].multiplier;
    return multiplier;
  },

  handleResize: function() {
    this.setState({
      scrubberBarWidth: ReactDOM.findDOMNode(this.refs.scrubberBar).clientWidth,
      playheadWidth: ReactDOM.findDOMNode(this.refs.playhead).clientWidth
    });
  },

  handlePlayheadMouseDown: function(evt) {
    if (this.props.controller.state.screenToShow == CONSTANTS.SCREEN.AD_SCREEN) return;
    this.props.controller.startHideControlBarTimer();
    if (evt.target.className.match("playhead") && evt.type !== "mousedown") {
        this.touchInitiated = true;
    }
    if ((this.touchInitiated && evt.type !== "mousedown") || (!this.touchInitiated && evt.type === "mousedown") ){
      //since mobile would fire both click and touched events,
      //we need to make sure only one actually does the work

      evt.preventDefault();
      if (this.touchInitiated){
        evt = evt.touches[0];
      }

      // we enter the scrubbing state to prevent constantly seeking while dragging
      // the playhead icon
      this.props.controller.beginSeeking();
      this.props.controller.renderSkin();

      if (!this.lastScrubX) {
        this.lastScrubX = evt.clientX;
      }

      if (!this.touchInitiated){
        ReactDOM.findDOMNode(this).parentNode.addEventListener("mousemove", this.handlePlayheadMouseMove);
        // attach a mouseup listener to the document for usability, otherwise scrubbing
        // breaks if your cursor leaves the player element
        document.addEventListener("mouseup", this.handlePlayheadMouseUp, true);
      }
      else {
        ReactDOM.findDOMNode(this).parentNode.addEventListener("touchmove", this.handlePlayheadMouseMove);
        document.addEventListener("touchend", this.handlePlayheadMouseUp, true);
      }
    }
  },

  handlePlayheadMouseMove: function(evt) {
    this.props.controller.startHideControlBarTimer();
    evt.preventDefault();
    if (this.props.seeking && this.props.duration > 0) {
      if (this.touchInitiated){
        evt = evt.touches[0];
      }
      var deltaX = evt.clientX - this.lastScrubX;
      var scrubbingPlayheadX = this.props.currentPlayhead * this.state.scrubberBarWidth / this.props.duration + deltaX;
      this.props.controller.updateSeekingPlayhead((scrubbingPlayheadX / this.state.scrubberBarWidth) * this.props.duration);
      this.setState({
        scrubbingPlayheadX: scrubbingPlayheadX
      });
      this.lastScrubX = evt.clientX;
    }
  },

  handlePlayheadMouseUp: function(evt) {
    if (!this.isMounted()) {
      return;
    }
    this.props.controller.startHideControlBarTimer();
    evt.preventDefault();
    // stop propagation to prevent it from bubbling up to the skin and pausing
    evt.stopPropagation(); // W3C
    evt.cancelBubble = true; // IE

    this.lastScrubX = null;
    if (!this.touchInitiated){
      ReactDOM.findDOMNode(this).parentNode.removeEventListener("mousemove", this.handlePlayheadMouseMove);
      document.removeEventListener("mouseup", this.handlePlayheadMouseUp, true);
    }
    else{
      ReactDOM.findDOMNode(this).parentNode.removeEventListener("touchmove", this.handlePlayheadMouseMove);
      document.removeEventListener("touchend", this.handlePlayheadMouseUp, true);
    }
    this.props.controller.seek(this.props.currentPlayhead);
    if (this.isMounted()) {
      this.setState({
        currentPlayhead: this.props.currentPlayhead,
        scrubbingPlayheadX: 0
      });
      this.props.controller.endSeeking();
    }
    this.touchInitiated = false;
  },

  handleScrubberBarMouseDown: function(evt) {
    if (this.props.controller.state.screenToShow == CONSTANTS.SCREEN.AD_SCREEN) return;
    if (evt.target.className.match("oo-playhead")) { return; }
    if (this.touchInitiated && evt.type === "mousedown") { return; }
    var offsetX = 0;
    this.touchInitiated = evt.type === "touchstart";
    if (this.touchInitiated){
      offsetX = evt.targetTouches[0].pageX - evt.target.getBoundingClientRect().left;
    }
    else {
      offsetX = evt.nativeEvent.offsetX == undefined ? evt.nativeEvent.layerX : evt.nativeEvent.offsetX;
    }

    this.setState({
      scrubbingPlayheadX: offsetX
    });
    this.props.controller.updateSeekingPlayhead((offsetX / this.state.scrubberBarWidth) * this.props.duration);
    this.handlePlayheadMouseDown(evt);
  },

  handleScrubberBarMouseOver: function(evt) {
    if (!this.props.skinConfig.controlBar.scrubberBar.thumbnailPreview) return;
    if (this.props.controller.state.screenToShow == CONSTANTS.SCREEN.AD_SCREEN) return;
    if (this.isMobile) { return; }
    if (evt.target.className.match("oo-playhead")) { return; }

    this.setState({
      hoveringX: evt.nativeEvent.offsetX
    });
  },

  handleScrubberBarMouseMove: function(evt) {
    this.handleScrubberBarMouseOver(evt);
  },

  handleScrubberBarMouseOut: function(evt) {
    if (!this.props.controller.state.thumbnails) return;
    this.setState({
      hoveringX: 0
    });
  },

  render: function() {
    var scrubberBarStyle = {
      backgroundColor: this.props.skinConfig.controlBar.scrubberBar.backgroundColor
    };
    var bufferedIndicatorStyle = {
      width: (parseFloat(this.props.buffered) / parseFloat(this.props.duration)) * 100 + "%",
      backgroundColor: this.props.skinConfig.controlBar.scrubberBar.bufferedColor
    };
    var playedIndicatorStyle = {
      width: Math.min((parseFloat(this.props.currentPlayhead) / parseFloat(this.props.duration)) * 100, 100) + "%",
      backgroundColor: this.props.skinConfig.controlBar.scrubberBar.playedColor
    };

    var playheadStyle = {};
    var playheadPaddingStyle = {};

    if (!this.state.transitionedDuringSeek) {

      if (this.state.scrubbingPlayheadX && this.state.scrubbingPlayheadX != 0) {
        playheadPaddingStyle.left = this.state.scrubbingPlayheadX;
      } else {
        playheadPaddingStyle.left = ((parseFloat(this.props.currentPlayhead) /
        parseFloat(this.props.duration)) * this.state.scrubberBarWidth);
      }

      playheadPaddingStyle.left = Math.max(
        Math.min(this.state.scrubberBarWidth - parseInt(this.state.playheadWidth)/2,
          playheadPaddingStyle.left), 0);

      if (isNaN(playheadPaddingStyle.left)) playheadPaddingStyle.left = 0;
    }

    var playheadMouseDown = this.handlePlayheadMouseDown;
    var scrubberBarMouseDown = this.handleScrubberBarMouseDown;
    var scrubberBarMouseOver = this.handleScrubberBarMouseOver;
    var scrubberBarMouseOut = this.handleScrubberBarMouseOut;
    var scrubberBarMouseMove = this.handleScrubberBarMouseMove;
    var playedIndicatorClassName = "oo-played-indicator";
    var playheadClassName = "oo-playhead";
    var scrubberBarClassName = "oo-scrubber-bar";

    if (this.props.controller.state.screenToShow == CONSTANTS.SCREEN.AD_SCREEN){
      playheadClassName += " oo-ad-playhead";
      playedIndicatorClassName += " oo-played-ad-indicator";
      playheadMouseDown = null;

      scrubberBarStyle.backgroundColor = this.props.skinConfig.controlBar.adScrubberBar.backgroundColor;
      bufferedIndicatorStyle.backgroundColor = this.props.skinConfig.controlBar.adScrubberBar.bufferedColor;
      playedIndicatorStyle.backgroundColor = this.props.skinConfig.controlBar.adScrubberBar.playedColor;
    }

    var thumbnailContainer = null;
    var thumbnailCarousel = null;
    var hoverTime = 0;
    var hoverPosition = 0;
    var hoveredIndicatorStyle = null;

    if (this.props.controller.state.thumbnails && (this.state.scrubbingPlayheadX || this.lastScrubX || this.state.hoveringX)) {
      if (this.state.scrubbingPlayheadX) {
        hoverPosition = this.state.scrubbingPlayheadX;
        hoverTime = (this.state.scrubbingPlayheadX / this.state.scrubberBarWidth) * this.props.duration;
        playheadClassName += " oo-playhead-scrubbing";

        thumbnailCarousel =
          React.createElement(ThumbnailCarousel, {
           thumbnails: this.props.controller.state.thumbnails, 
           hoverPosition: hoverPosition, 
           duration: this.props.duration, 
           hoverTime: hoverTime > 0 ? hoverTime : 0, 
           scrubberBarWidth: this.state.scrubberBarWidth})
      } else if (this.lastScrubX) {//to show thumbnail when clicking on playhead
        hoverPosition = this.props.currentPlayhead * this.state.scrubberBarWidth / this.props.duration;
        hoverTime = this.props.currentPlayhead;
        playheadClassName += " oo-playhead-scrubbing";
      } else if (this.state.hoveringX) {
        hoverPosition = this.state.hoveringX;
        hoverTime = (this.state.hoveringX / this.state.scrubberBarWidth) * this.props.duration;
        hoveredIndicatorStyle = {
          width: Math.min((parseFloat(hoverTime) / parseFloat(this.props.duration)) * 100, 100) + "%",
          backgroundColor: this.props.skinConfig.controlBar.scrubberBar.playedColor
        };
        scrubberBarClassName += " oo-scrubber-bar-hover";
        playheadClassName += " oo-playhead-hovering";
      }
      if (!thumbnailCarousel) {
        thumbnailContainer = (
          React.createElement(Thumbnail, {
           thumbnails: this.props.controller.state.thumbnails, 
           hoverPosition: hoverPosition, 
           duration: this.props.duration, 
           hoverTime: hoverTime > 0 ? hoverTime : 0})
        )
      }
    }

    return (
      React.createElement("div", {className: "oo-scrubber-bar-container", ref: "scrubberBarContainer", onMouseOver: scrubberBarMouseOver, onMouseOut: scrubberBarMouseOut, onMouseMove: scrubberBarMouseMove}, 
        thumbnailContainer, 
        thumbnailCarousel, 
        React.createElement("div", {className: "oo-scrubber-bar-padding", ref: "scrubberBarPadding", onMouseDown: scrubberBarMouseDown, onTouchStart: scrubberBarMouseDown}, 
          React.createElement("div", {ref: "scrubberBar", className: scrubberBarClassName, style: scrubberBarStyle}, 
            React.createElement("div", {className: "oo-buffered-indicator", style: bufferedIndicatorStyle}), 
            React.createElement("div", {className: "oo-hovered-indicator", style: hoveredIndicatorStyle}), 
            React.createElement("div", {className: playedIndicatorClassName, style: playedIndicatorStyle}), 
            React.createElement("div", {className: "oo-playhead-padding", style: playheadPaddingStyle, 
              onMouseDown: playheadMouseDown, onTouchStart: playheadMouseDown}, 
              React.createElement("div", {ref: "playhead", className: playheadClassName, style: playheadStyle})
            )
          )
        )
      )
    );
  }
});

ScrubberBar.defaultProps = {
  skinConfig: {
    controlBar: {
      scrubberBar: {
        backgroundColor: 'rgba(5,175,175,1)',
        bufferedColor: 'rgba(127,5,127,1)',
        playedColor: 'rgba(67,137,5,1)'
      },
      adScrubberBar: {
        backgroundColor: 'rgba(175,175,5,1)',
        bufferedColor: 'rgba(127,5,127,1)',
        playedColor: 'rgba(5,63,128,1)'
      }
    }
  }
};

module.exports = ScrubberBar;

},{"../constants/constants":36,"../mixins/resizeMixin":40,"./thumbnail":31,"./thumbnailCarousel":32,"react":212,"react-dom":55}],26:[function(require,module,exports){
/********************************************************************
 SHARE PANEL
 *********************************************************************/
/**
 * Panel component for Share Screen.
 *
 * @class SharePanel
 * @constructor
 */
var React = require('react'),
    ClassNames = require('classnames'),
    Utils = require('./utils'),
    CONSTANTS = require('../constants/constants');

var SharePanel = React.createClass({displayName: "SharePanel",
  tabs: {SHARE: "share", EMBED: "embed"},

  getInitialState: function() {
    return {
      activeTab: this.tabs.SHARE,
      hasError: false
    };
  },

  getActivePanel: function() {
    if (this.state.activeTab === this.tabs.SHARE) {
      var titleString = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.SHARE_CALL_TO_ACTION, this.props.localizableStrings);

      return (
        React.createElement("div", {className: "oo-share-tab-panel"}, 
          React.createElement("div", {className: "oo-social-action-text oo-text-capitalize"}, titleString), 
          React.createElement("a", {className: "oo-twitter", onClick: this.handleTwitterClick}, " "), 
          React.createElement("a", {className: "oo-facebook", onClick: this.handleFacebookClick}, " "), 
          React.createElement("a", {className: "oo-google-plus", onClick: this.handleGPlusClick}, " "), 
          React.createElement("a", {className: "oo-email-share", onClick: this.handleEmailClick}, " ")
        )
      );
    }

    else if (this.state.activeTab === this.tabs.EMBED) {
      try {
        var iframeURL = this.props.skinConfig.shareScreen.embed.source
          .replace("<ASSET_ID>", this.props.assetId)
          .replace("<PLAYER_ID>", this.props.playerParam.playerBrandingId)
          .replace("<PUBLISHER_ID>", this.props.playerParam.pcode);
      } catch(err) {
        iframeURL = "";
      }

      return (
        React.createElement("div", {className: "oo-share-tab-panel"}, 
          React.createElement("textarea", {className: "oo-form-control", 
                    rows: "3", 
                    value: iframeURL, 
                    readOnly: true})
        )
      );
    }
  },

  handleEmailClick: function(event) {
    event.preventDefault();
    var emailBody = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.EMAIL_BODY, this.props.localizableStrings);
    var mailToUrl = "mailto:";
    mailToUrl += "?subject=" + encodeURIComponent(this.props.contentTree.title);
    mailToUrl += "&body=" + encodeURIComponent(emailBody + location.href);
    //location.href = mailToUrl; //same window
    var emailWindow = window.open(mailToUrl, "email", "height=315,width=780"); //new window
    setTimeout(function(){
      try {
         // If we can't access href, a web client has taken over and this will throw
         // an exception, preventing the window from being closed.
        var test = emailWindow.location.href;
        emailWindow.close()
      } catch(e) {};
      // Generous 2 second timeout to give the window time to redirect if it's going to a web client
    }, 2000);
  },

  handleFacebookClick: function() {
    var facebookUrl = "http://www.facebook.com/sharer.php";
    facebookUrl += "?u=" + encodeURIComponent(location.href);
    window.open(facebookUrl, "facebook window", "height=315,width=780");
  },

  handleGPlusClick: function() {
    var gPlusUrl = "https://plus.google.com/share";
    gPlusUrl += "?url=" + encodeURIComponent(location.href);
    window.open(gPlusUrl, "google+ window", "menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600");
  },

  handleTwitterClick: function() {
    var twitterUrl = "https://twitter.com/intent/tweet";
    twitterUrl += "?text=" + encodeURIComponent(this.props.contentTree.title+": ");
    twitterUrl += "&url=" + encodeURIComponent(location.href);
    window.open(twitterUrl, "twitter window", "height=300,width=750");
  },

  showPanel: function(panelToShow) {
    this.setState({activeTab: panelToShow});
  },

  render: function() {
    var shareTab = ClassNames({
      'oo-share-tab': true,
      'oo-active': this.state.activeTab == this.tabs.SHARE
    });
    var embedTab = ClassNames({
      'oo-embed-tab': true,
      'oo-active': this.state.activeTab == this.tabs.EMBED
    });

    var shareString = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.SHARE, this.props.localizableStrings),
        embedString = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.EMBED, this.props.localizableStrings);

    return (
      React.createElement("div", {className: "oo-content-panel oo-share-panel"}, 
        React.createElement("div", {className: "oo-tab-row"}, 
          React.createElement("a", {className: shareTab, onClick: this.showPanel.bind(this, this.tabs.SHARE)}, shareString), 
          React.createElement("a", {className: embedTab, onClick: this.showPanel.bind(this, this.tabs.EMBED)}, embedString)
        ), 
        this.getActivePanel()
      )
    );
  }
});

SharePanel.defaultProps = {
  contentTree: {
    title: ''
  }
};

module.exports = SharePanel;

},{"../constants/constants":36,"./utils":34,"classnames":51,"react":212}],27:[function(require,module,exports){
var React = require('react'),
    Utils = require('./utils');

var Slider = React.createClass({displayName: "Slider",

  componentDidMount: function() {
    this.handleSliderColoring(this.props);
  },

  componentWillReceiveProps: function(nextProps) {
    if (nextProps.value != this.props.value) {
      this.handleSliderColoring(nextProps);
    }
  },

  handleSliderColoring: function(props){
    if (!Utils.isEdge()){
      var input = this.refs[this.props.itemRef];
      var style = window.getComputedStyle(input, null);

      var colorBeforeThumb = style.getPropertyValue("border-left-color");
      var colorAfterThumb = style.getPropertyValue("border-right-color");

      var value = (props.value - props.minValue)/(props.maxValue - props.minValue);
      input.style.backgroundImage = [
        '-webkit-gradient(',
          'linear, ',
          'left top, ',
          'right top, ',
          'color-stop(' + value + ', '+ colorBeforeThumb + '), ',
          'color-stop(' + value + ', '+ colorAfterThumb + ')',
        ')'
      ].join('');
    }
  },

  changeValue: function(event) {
    if (event.type == 'change' && !Utils.isIE()){
      this.props.onChange(event);
      this.handleSliderColoring(this.props);
    }
    else if (Utils.isIE()) {
      this.props.onChange(event);
    }
  },

  render: function() {
    return (
      React.createElement("input", {type: "range", className: this.props.className, min: this.props.minValue, max: this.props.maxValue, 
           value: this.props.value, step: this.props.step, ref: this.props.itemRef, 
           onChange: this.changeValue, onClick: this.changeValue, onMouseMove: this.changeValue})
    );
  }
});
module.exports = Slider;

},{"./utils":34,"react":212}],28:[function(require,module,exports){
var React = require('react');

var Spinner = React.createClass({displayName: "Spinner",
  render: function() {
    return (
      React.createElement("div", {className: "oo-spinner-screen"}, 
        React.createElement("div", {className: "oo-spinner-wrapper"}, 
          React.createElement("img", {src: this.props.loadingImage, className: "oo-spinner"})
        )
      )
    );
  }
});
module.exports = Spinner;

},{"react":212}],29:[function(require,module,exports){
// taken from https://github.com/pedronauck/react-simpletabs

var React = require('react'),
    ClassNames = require('classnames'),
    Icon = require('./icon');

var Tabs = React.createClass({displayName: "Tabs",
  getInitialState: function() {
    return {
      tabActive: this.props.tabActive
    };
  },

  componentDidMount: function() {
    var index = this.state.tabActive;
    var selectedPanel = this.refs['tab-panel'];
    var selectedMenu = this.refs[("tab-menu-" + index)];

    if (this.props.onMount) {
      this.props.onMount(index, selectedPanel, selectedMenu);
    }
  },

  componentWillReceiveProps: function(newProps) {
    if(newProps.tabActive && newProps.tabActive !== this.props.tabActive){
      this.setState({tabActive: newProps.tabActive});
    }
  },

  setActive: function(index, e) {
    e.preventDefault();

    var onAfterChange = this.props.onAfterChange;
    var onBeforeChange = this.props.onBeforeChange;
    var selectedPanel = this.refs['tab-panel'];
    var selectedTabMenu = this.refs[("tab-menu-" + index)];

    if (onBeforeChange) {
      var cancel = onBeforeChange(index, selectedPanel, selectedTabMenu);
      if(cancel === false){ return }
    }

    this.setState({ tabActive: index }, function()  {
      if (onAfterChange) {
        onAfterChange(index, selectedPanel, selectedTabMenu);
      }
    });
  },

  getMenuItems: function() {
    if (!this.props.children) {
      throw new Error('Tabs must contain at least one Tabs.Panel');
    }

    if (!Array.isArray(this.props.children)) {
      this.props.children = [this.props.children];
    }

    var menuItems = this.props.children
      .map(function(panel)  {return typeof panel === 'function' ? panel() : panel;})
      .filter(function(panel)  {return panel;})
      .map(function(panel, index)  {
        var ref = ("tab-menu-" + (index + 1));
        var title = panel.props.title;
        var classes = ClassNames(
          'tabs-menu-item',
          this.state.tabActive === (index + 1) && 'is-active',
          'tabs-menu-item-' + index
        );

        return (
          React.createElement("li", {ref: ref, key: index, className: classes}, 
            React.createElement("a", {onClick: this.setActive.bind(this, index + 1)}, 
              title
            )
          )
        );
      }.bind(this));

    return (
      React.createElement("nav", {className: "tabs-navigation", ref: "tabsNavigation"}, 
        React.createElement("ul", {className: "tabs-menu"}, menuItems)
      )
    );
  },

  getSelectedPanel: function() {
    var index = this.state.tabActive - 1;
    var panel = this.props.children[index];

    return (
      React.createElement("article", {ref: "tab-panel", className: "tab-panel"}, 
        panel
      )
    );
  },

  handleLeftChevronClick: function(event) {
    event.preventDefault();
    this.refs.tabsNavigation.scrollLeft -= 30;
  },

  handleRightChevronClick: function(event) {
    event.preventDefault();
    this.refs.tabsNavigation.scrollLeft += 30;
  },

  render: function() {
    var className = ClassNames('tabs', this.props.className);

    var leftScrollButton = ClassNames({
      'oo-left-tab-button': true,
      'oo-left-tab-button-active': this.props.showScrollButtons
    });
    var rightScrollButton = ClassNames({
      'oo-right-tab-button': true,
      'oo-right-tab-button-active': this.props.showScrollButtons
    });

    return (
      React.createElement("div", {className: className}, 
        this.getMenuItems(), 
        this.getSelectedPanel(), 
        React.createElement("a", {className: leftScrollButton, ref: "leftChevron", onClick: this.handleLeftChevronClick}, 
          React.createElement(Icon, React.__spread({}, 
            this.props, 
            {icon: "left"})
          )
        ), 
        React.createElement("a", {className: rightScrollButton, ref: "rightChevron", onClick: this.handleRightChevronClick}, 
          React.createElement(Icon, React.__spread({}, 
            this.props, 
            {icon: "right"})
          )
        )
      )
    );
  }
});

Tabs.propTypes = {
  className: React.PropTypes.oneOfType([
    React.PropTypes.array,
    React.PropTypes.string,
    React.PropTypes.object
  ]),
  tabActive: React.PropTypes.number,
  onMount: React.PropTypes.func,
  onBeforeChange: React.PropTypes.func,
  onAfterChange: React.PropTypes.func,
  children: React.PropTypes.oneOfType([
    React.PropTypes.array,
    React.PropTypes.element
  ]).isRequired
};

Tabs.defaultProps = {
  tabActive: 1
};

module.exports = Tabs;


Tabs.Panel = React.createClass({
  displayName: 'Panel',
  propTypes: {
    title: React.PropTypes.string.isRequired,
    children: React.PropTypes.oneOfType([
      React.PropTypes.array,
      React.PropTypes.element
    ]).isRequired
  },

  render: function() {
    return (
      React.createElement("span", null, this.props.children)
    );
  }
});

},{"./icon":22,"classnames":51,"react":212}],30:[function(require,module,exports){
/**
 * Display component for video text tracks
 *
 * @module TextTrackPanel
 */
var React = require('react');
var baseFontSize = 1.0;

var TextTrackPanel = React.createClass({displayName: "TextTrackPanel",

  colorMap: {
    "White": "255,255,255",
    "Blue": "0,0,255",
    "Magenta": "255,0,255",
    "Green": "0,255,0",
    "Yellow": "255,255,0",
    "Red": "255,0,0",
    "Cyan": "0,255,255",
    "Black": "0,0,0",
    "Transparent": "0,0,0"
  },

  fontTypeMap: {
    "Monospaced Serif": '"Courier New", Courier, "Nimbus Mono L", "Cutive Mono", monospace',
    "Proportional Serif": '"Times New Roman", Times, Georgia, Cambria, "PT Serif Caption", serif',
    "Monospaced Sans-Serif": '"Deja Vu Sans Mono", "Lucida Console", Monaco, Consolas, "PT Mono", monospace',
    "Proportional Sans-Serif": 'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif',
    "Casual": '"Comic Sans MS", Impact, Handlee, fantasy',
    "Cursive": '"Monotype Corsiva", "URW Chancery L", "Apple Chancery", "Dancing Script", cursive',
    "Small Capitals": '"Arial Unicode Ms", Arial, Helvetica, Verdana, "Marcellus SC", sans-serif'
  },

  fontVariantMap: {
    "Monospaced Serif": 'normal',
    "Proportional Serif": 'normal',
    "Monospaced Sans-Serif": 'normal',
    "Proportional Sans-Serif": 'normal',
    "Casual": 'normal',
    "Cursive": 'normal',
    "Small Capitals": 'small-caps'
  },

  fontSizeMap: {
    "Small": {
      "xs": (baseFontSize * 0.8) + "em",
      "sm": (baseFontSize * 1.0) + "em",
      "md": (baseFontSize * 1.2) + "em",
      "lg": (baseFontSize * 1.4) + "em"
    },
    "Medium": {
      "xs": (baseFontSize * 1.2) + "em",
      "sm": (baseFontSize * 1.4) + "em",
      "md": (baseFontSize * 1.6) + "em",
      "lg": (baseFontSize * 1.8) + "em"
    },
    "Large": {
      "xs": (baseFontSize * 1.6) + "em",
      "sm": (baseFontSize * 1.8) + "em",
      "md": (baseFontSize * 2.0) + "em",
      "lg": (baseFontSize * 2.2) + "em"
    },
    "Extra Large": {
      "xs": (baseFontSize * 2.0) + "em",
      "sm": (baseFontSize * 2.2) + "em",
      "md": (baseFontSize * 2.4) + "em",
      "lg": (baseFontSize * 2.6) + "em"
    }
  },

  textEnhancementMap: {
    "Uniform": "none",
    "Depressed": "1px 1px white",
    "Raised": "-1px -1px white, -3px 0px 5px black",
    "Shadow": "2px 2px 2px #1a1a1a"
  },

  setWindowBackgroundStyle: function(color, opacity) {
    if (color == "Transparent") opacity = 0;
    return {
      backgroundColor: "rgba(" + this.colorMap[color] + "," + opacity + ")"
    }
  },

  setTextStyle: function(color, opacity, fontType, fontSize, textEnhancement) {
    return {
      color: "rgba(" + this.colorMap[color] + "," + opacity + ")",
      fontFamily: this.fontTypeMap[fontType],
      fontVariant: this.fontVariantMap[fontType],
      fontSize: this.fontSizeMap[fontSize][this.props.responsiveView],
      textShadow: this.textEnhancementMap[textEnhancement]
    }
  },

  render: function() {
    if (!this.props.cueText) {
      return null;
    }

    return (
      React.createElement("div", {className: "oo-text-track-container"}, 
        React.createElement("div", {
          className: "oo-text-track-window", 
          style: 
            this.setWindowBackgroundStyle(
              this.props.closedCaptionOptions.windowColor,
              this.props.closedCaptionOptions.windowOpacity
            )
          
          }, 
          React.createElement("div", {
            className: "oo-text-track-background", 
            style: 
              this.setWindowBackgroundStyle(
                this.props.closedCaptionOptions.backgroundColor,
                this.props.closedCaptionOptions.backgroundOpacity
              )
            
            }, 
            React.createElement("div", {
              className: "oo-text-track", 
              style: 
                this.setTextStyle(
                  this.props.closedCaptionOptions.textColor,
                  this.props.closedCaptionOptions.textOpacity,
                  this.props.closedCaptionOptions.fontType,
                  this.props.closedCaptionOptions.fontSize,
                  this.props.closedCaptionOptions.textEnhancement
                )
              
              }, 
              this.props.cueText
            )
          )
        )
      )
    );
  }
});

TextTrackPanel.propTypes = {
  cueText: React.PropTypes.string,
  closedCaptionOptions: React.PropTypes.shape({
    textColor: React.PropTypes.string,
    windowColor: React.PropTypes.string,
    backgroundColor: React.PropTypes.string,
    textOpacity: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
    backgroundOpacity: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
    windowOpacity: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
    fontType: React.PropTypes.string,
    fontSize: React.PropTypes.string,
    textEnhancement: React.PropTypes.string
  })
};

TextTrackPanel.defaultProps = {
  cueText: null,
  closedCaptionOptions: {
    textColor: "White",
    windowColor: "Transparent",
    backgroundColor: "Black",
    textOpacity: 1,
    backgroundOpacity: 0.6,
    windowOpacity: 0,
    fontType: "Proportional Sans-Serif",
    fontSize: "Medium",
    textEnhancement: "Uniform"
  }
};

module.exports = TextTrackPanel;

},{"react":212}],31:[function(require,module,exports){
/**
 * Thumbnail component
 *
 * @module Thumbnail
 */
var React = require('react'),
    Utils = require('./utils');

var Thumbnail = React.createClass({displayName: "Thumbnail",
  shouldComponentUpdate: function(nextProps) {
    return (nextProps.hoverPosition != this.props.hoverPosition);
  },

  render: function() {
    var thumbnail = Utils.findThumbnail(this.props.thumbnails, this.props.hoverTime, this.props.duration);
    var time = isFinite(parseInt(this.props.hoverTime)) ? Utils.formatSeconds(parseInt(this.props.hoverTime)) : null;

    var thumbnailStyle = {};
    thumbnailStyle.left = this.props.hoverPosition;
    thumbnailStyle.backgroundImage = "url("+thumbnail.url+")";

    return (
      React.createElement("div", {className: "oo-scrubber-thumbnail-container"}, 
        React.createElement("div", {className: "oo-thumbnail", ref: "thumbnail", style: thumbnailStyle}, 
          React.createElement("div", {className: "oo-thumbnail-time"}, time)
        )
      )
    );
  }
});

Thumbnail.defaultProps = {
  thumbnails: {},
  hoverPosition: 0,
  duration: 0,
  hoverTime: 0
};

module.exports = Thumbnail;

},{"./utils":34,"react":212}],32:[function(require,module,exports){
/**
 * ThumbnailCarousel component
 *
 * @module ThumbnailCarousel
 */

var React = require('react'),
    ReactDOM = require('react-dom'),
    Utils = require('./utils');

var ThumbnailCarousel = React.createClass({displayName: "ThumbnailCarousel",
  getInitialState: function() {
    return {
      thumbnailWidth: 0,
      thumbnailHeight: 0,
      centerThumbnailWidth: 0,
      centerThumbnailHeight: 0,
      thumbnailPadding: 6
    };
  },

  componentDidMount: function() {
    var thumbnail = ReactDOM.findDOMNode(this.refs.thumbnail);
    var carousel = ReactDOM.findDOMNode(this.refs.thumbnailCarousel);
    var thumbnailStylePadding = thumbnail ? window.getComputedStyle(thumbnail, null).getPropertyValue("padding") : 0;
    thumbnailStylePadding = parseFloat(thumbnailStylePadding); // convert css px to number
    var thumbnailPadding = !isNaN(thumbnailStylePadding) ? thumbnailStylePadding : this.state.thumbnailPadding;

    if (thumbnail && carousel && thumbnail.clientWidth && carousel.clientWidth) {
      this.setState({
        thumbnailWidth: thumbnail.clientWidth,
        thumbnailHeight: thumbnail.clientHeight,
        centerThumbnailWidth: carousel.clientWidth,
        centerThumbnailHeight: carousel.clientHeight,
        thumbnailPadding: thumbnailPadding
      });
    }
  },

  findThumbnailsAfter: function(data) {
    var start = (data.scrubberBarWidth + data.centerWidth) / 2;
    var thumbnailsAfter = [];
    for (var i = data.pos + 1, j = 0; i < data.timeSlices.length; i++, j++) {
      var left = start + data.padding + j * (data.imgWidth + data.padding);
      if (left + data.imgWidth <= data.scrubberBarWidth) {
        var thumbStyle = { left: left, top: data.top, backgroundImage: "url(" + data.thumbnails.data.thumbnails[data.timeSlices[i]][data.width].url + ")" };
        thumbnailsAfter.push(React.createElement("div", {className: "oo-thumbnail-carousel-image", key: i, ref: "thumbnail", style: thumbStyle}));
      }
    }
    return thumbnailsAfter;
  },

  findThumbnailsBefore: function(data) {
    var start = (data.scrubberBarWidth - data.centerWidth) / 2;

    var thumbnailsBefore = [];
    for (var i = data.pos - 1, j = 0; i >= 0; i--, j++) {
      var left = start - (j + 1) * (data.imgWidth + data.padding);
      if (left >= 0) {
        var thumbStyle = { left: left, top: data.top, backgroundImage: "url(" + data.thumbnails.data.thumbnails[data.timeSlices[i]][data.width].url + ")" };
        thumbnailsBefore.push(React.createElement("div", {className: "oo-thumbnail-carousel-image", key: i, ref: "thumbnail", style: thumbStyle}));
      }
    }
    return thumbnailsBefore;
  },

  render: function() {
    var centralThumbnail = Utils.findThumbnail(this.props.thumbnails, this.props.hoverTime, this.props.duration);
    var data = {
      thumbnails: this.props.thumbnails,
      timeSlices: this.props.thumbnails.data.available_time_slices,
      width: this.props.thumbnails.data.available_widths[0],
      imgWidth: this.state.thumbnailWidth,
      centerWidth: this.state.centerThumbnailWidth,
      scrubberBarWidth: this.props.scrubberBarWidth,
      top: this.state.centerThumbnailHeight - this.state.thumbnailHeight,
      pos: centralThumbnail.pos,
      padding: this.state.thumbnailPadding
    };

    var thumbnailsBefore = this.findThumbnailsBefore(data);
    var thumbnailsAfter = this.findThumbnailsAfter(data);
    var thumbnailStyle = { left: (data.scrubberBarWidth - data.centerWidth) / 2, backgroundImage: "url(" + centralThumbnail.url + ")" };
    var time = isFinite(parseInt(this.props.hoverTime)) ? Utils.formatSeconds(parseInt(this.props.hoverTime)) : null;

    return (
      React.createElement("div", {className: "oo-scrubber-carousel-container"}, 
        thumbnailsBefore, 
        React.createElement("div", {className: "oo-thumbnail-carousel-center-image", ref: "thumbnailCarousel", style: thumbnailStyle}, 
          React.createElement("div", {className: "oo-thumbnail-carousel-time"}, time)
        ), 
        thumbnailsAfter
      )
    );
  }
});

ThumbnailCarousel.defaultProps = {
  thumbnails: {},
  duration: 0,
  hoverTime: 0,
  scrubberBarWidth: 0
};

module.exports = ThumbnailCarousel;

},{"./utils":34,"react":212,"react-dom":55}],33:[function(require,module,exports){
/********************************************************************
  UP NEXT PANEL
*********************************************************************/
/**
* The screen used while the video is playing.
*
* @class UpNextPanel
* @constructor
*/
var React = require('react'),
    CONSTANTS = require('./../constants/constants'),
    Utils = require('./utils'),
    CloseButton = require('./closeButton'),
    CountDownClock = require('./countDownClock'),
    Icon = require('../components/icon');

var UpNextPanel = React.createClass({displayName: "UpNextPanel",
  closeUpNextPanel: function() {
    this.props.controller.upNextDismissButtonClicked();
  },

  handleStartUpNextClick: function(event) {
    event.preventDefault();
    // Use the same way as sending out the click event on discovery content
    var eventData = {
      "clickedVideo": this.props.upNextInfo.upNextData,
      "custom": {
        "source": CONSTANTS.SCREEN.UP_NEXT_SCREEN,
        "countdown": 0,
        "autoplay": true
      }
    };
    this.props.controller.sendDiscoveryClickEvent(eventData, false);
  },

  render: function() {
    var upNextString = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.UP_NEXT, this.props.localizableStrings);
    var thumbnailStyle = {
      backgroundImage: "url('" + this.props.upNextInfo.upNextData.preview_image_url + "')"
    };

    return (
      React.createElement("div", {className: "oo-up-next-panel"}, 
        React.createElement("a", {className: "oo-up-next-content", onClick: this.handleStartUpNextClick, style: thumbnailStyle}, 
          React.createElement(Icon, React.__spread({},  this.props, {icon: "play"}))
        ), 

        React.createElement("div", {className: "oo-content-metadata"}, 
          React.createElement("div", {className: "oo-up-next-title"}, 
            React.createElement(CountDownClock, React.__spread({},  this.props, {timeToShow: this.props.skinConfig.upNext.timeToShow, currentPlayhead: this.props.currentPlayhead})), 

            React.createElement("div", {className: "oo-up-next-title-text oo-text-truncate"}, 
              upNextString, ": ", this.props.upNextInfo.upNextData.name
            )
          ), 

          React.createElement("div", {className: "oo-content-description oo-text-truncate"}, 
            this.props.upNextInfo.upNextData.description
          )
        ), 

        React.createElement(CloseButton, React.__spread({},  this.props, 
          {cssClass: "oo-up-next-close-btn", closeAction: this.closeUpNextPanel}))
      )
    );
  }
});

UpNextPanel.propTypes = {
  upNextInfo: React.PropTypes.shape({
    upNextData: React.PropTypes.shape({
      preview_image_url: React.PropTypes.string,
      name: React.PropTypes.string,
      description:React.PropTypes.string
    })
  }),
  skinConfig: React.PropTypes.shape({
    upNext: React.PropTypes.shape({
      timeToShow: React.PropTypes.string
    }),
    icons: React.PropTypes.objectOf(React.PropTypes.object)
  })
};

UpNextPanel.defaultProps = {
  skinConfig: {
    upNext: {
      timeToShow: "10"
    },
    icons: {
      play:{fontStyleClass:'oo-icon oo-icon-play'},
      dismiss:{fontStyleClass:'oo-icon oo-icon-close'}
    }
  },
  upNextInfo: {
    upNextData: {}
  },
  controller: {
    upNextDismissButtonClicked: function(){},
    sendDiscoveryClickEvent: function(a,b){}
  }
};

module.exports = UpNextPanel;

},{"../components/icon":22,"./../constants/constants":36,"./closeButton":4,"./countDownClock":18,"./utils":34,"react":212}],34:[function(require,module,exports){
/**
* Utility class that holds helper functions
*
* @module Utils
*/

var Utils = {
  /**
  * Trims the given text to fit inside of the given element, truncating with ellipsis.
  *
  * @function truncateTextToWidth
  * @param {DOMElement} element - The DOM Element to fit text inside
  * @param {String} text - The string to trim
  * @returns {String} String truncated to fit the width of the element
  */
  truncateTextToWidth: function(element, text) {
    var testText = document.createElement("span");
    testText.style.visibility = "hidden";
    testText.style.position = "absolute";
    testText.style.top = "0";
    testText.style.left = "0";
    testText.style.whiteSpace = "nowrap";
    testText.innerHTML = text;
    element.appendChild(testText);
    var actualWidth = element.clientWidth;
    var textWidth = testText.scrollWidth;
    var truncatedText = "";
    if (textWidth > (actualWidth * 1.8)){
      var truncPercent = actualWidth / textWidth;
      var newWidth = (Math.floor(truncPercent * text.length) * 1.8) - 3;
      truncatedText = text.slice(0,newWidth) + "...";
    }
    else {
      truncatedText = text;
    }
    element.removeChild(testText);
    return truncatedText;
  },

  /**
  * Returns a shallow clone of the object given
  *
  * @function clone
  * @param {Object} object - Object to be cloned
  * @returns {Object} Clone of the given object
  */

  clone: function(object) {
    var clonedObj = {};
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        clonedObj[key] = object[key];
      }
    }
    return clonedObj;
  },

  /**
  * Clones the given object and merges in the keys and values of the second object.
  * Attributes in the cloned original will be overwritten.
  *
  * @function extend
  * @param {Object} original - Object to be extended
  * @param {Object} toMerge - Object with properties to be merged in
  * @returns {Object} Cloned and merged object
  */

  extend: function(original, toMerge) {
    var extendedObject = Utils.clone(original);
    for (var key in toMerge) {
      if (toMerge.hasOwnProperty(key)) {
        extendedObject[key] = toMerge[key];
      }
    }
    return extendedObject;
  },

  /**
  * Convert raw seconds into human friendly HH:MM format
  *
  * @function formatSeconds
  * @param {integer} time The time to format in seconds
  * @return {String} The time as a string in the HH:MM format
  */
  formatSeconds: function(time) {
    var timeInSeconds = Math.abs(time);
    var seconds = parseInt(timeInSeconds,10) % 60;
    var hours = parseInt(timeInSeconds / 3600, 10);
    var minutes = parseInt((timeInSeconds - hours * 3600) / 60, 10);

    if (hours < 10) {
      hours = '0' + hours;
    }

    if (minutes < 10) {
      minutes = '0' + minutes;
    }

    if (seconds < 10) {
      seconds = '0' + seconds;
    }

    var timeStr = (parseInt(hours,10) > 0) ? (hours + ":" + minutes + ":" + seconds) : (minutes + ":" + seconds);
    if (time >= 0) {
      return timeStr;
    } else {
      return "-" + timeStr;
    }
  },

  /**
  * Check if the current browser is Safari
  *
  * @function isSafari
  * @returns {Boolean} Whether the browser is Safari or not
  */
  isSafari: function () {
    return (!!window.navigator.userAgent.match(/AppleWebKit/) &&
            !window.navigator.userAgent.match(/Chrome/));
  },

  /**
  * Check if the current browser is Edge
  *
  * @function isEdge
  * @returns {Boolean} Whether the browser is Edge or not
  */
  isEdge: function () {
    return (!!window.navigator.userAgent.match(/Edge/));
  },

  /**
  * Check if the current browser is Internet Explorer
  *
  * @function isIE
  * @returns {Boolean} Whether the browser is IE or not
  */
  isIE: function() {
    return (!!window.navigator.userAgent.match(/MSIE/) || !!window.navigator.userAgent.match(/Trident/));
  },

  /**
  * Check if the current device is Android
  *
  * @function isAndroid
  * @returns {Boolean} Whether the browser is running on Android or not
  */
  isAndroid: function() {
    var os = window.navigator.appVersion;
    return !!os.match(/Android/);
  },

  /**
  * Check if the current device is iOS
  *
  * @function isIos
  * @returns {Boolean} Whether the device is iOS or not
  */
  isIos: function() {
    var platform = window.navigator.platform;
    return !!(platform.match(/iPhone/) || platform.match(/iPad/) || platform.match(/iPod/));
  },

  /**
  * Check if the current device is an iPhone
  *
  * @function isIPhone
  * @returns {Boolean} Whether the device is an iPhone or not
  */
  isIPhone: function() {
    var platform = window.navigator.platform;
    return !!(platform.match(/iPhone/) || platform.match(/iPod/));
  },

  /**
  * Check if the current device is a mobile device
  *
  * @function isMobile
  * @returns {Boolean} Whether the browser device a mobile device or not
  */
  isMobile: function() {
    return (this.isAndroid() || this.isIos());
  },

  /**
  * Check if the current browser is Internet Explorer 10
  *
  * @function isIE10
  * @returns {Boolean} Whether the browser is IE10 or not
  */
  isIE10: function() {
    return !!window.navigator.userAgent.match(/MSIE 10/);
  },

  /**
  * Determine the best language to use for localization
  *
  * @function getLanguageToUse
  * @param {Object} skinConfig - The skin configuration file to read languages from
  * @returns {String} The ISO code of the language to use
  */
  getLanguageToUse: function(skinConfig) {
    var localization = skinConfig.localization;
    var language, availableLanguages;

    // set lang to default lang in skin config
    language = localization.defaultLanguage;

    // if no default lang in skin config check browser lang settings
    if(!language) {
      if(window.navigator.languages){
        // A String, representing the language version of the browser.
        // Examples of valid language codes are: "en", "en-US", "de", "fr", etc.
        language = window.navigator.languages[0];
      }
      else {
        // window.navigator.browserLanguage: current operating system language
        // window.navigator.userLanguage: operating system's natural language setting
        // window.navigator.language: the preferred language of the user, usually the language of the browser UI
        language = window.navigator.browserLanguage || window.navigator.userLanguage || window.navigator.language;
      }

      // remove lang sub-code
      var primaryLanguage = language.substr(0,2);

      // check available lang file for browser lang
      for(var i = 0; i < localization.availableLanguageFile.length; i++) {
        availableLanguages = localization.availableLanguageFile[i];
        // if lang file available set lang to browser primary lang
        if (primaryLanguage == availableLanguages.language){
          language = primaryLanguage;
        }
      }
    }
    return language;
  },

  /**
  * Get the localized string for a given localization key
  *
  * @function getLocalizedString
  * @param {String} language - ISO code of the language to use
  * @param {String} stringId - The key of the localized string to retrieve
  * @param {Object} localizedStrings - Mapping of string keys to localized values
  * @returns {String} The localizted string
  */
  getLocalizedString: function(language, stringId, localizedStrings) {
    try {
      return localizedStrings[language][stringId];
    } catch (e) {
      return "";
    }

  },

  /**
  * Highlight the given element for hover effects
  *
  * @function Highlight
  * @param {DOMElement} target - The element to Highlight
  */
  highlight: function(target, opacity, color) {
    target.style.opacity = opacity;
    target.style.color = color;
    target.style.WebkitFilter = "drop-shadow(0px 0px 3px rgba(255,255,255,0.8))";
    target.style.filter = "drop-shadow(0px 0px 3px rgba(255,255,255,0.8))";
    target.style.msFilter = "progid:DXImageTransform.Microsoft.Dropshadow(OffX=0, OffY=0, Color='#fff')";
  },

  /**
  * Remove the highlight effect of the given element
  *
  * @function removeHighlight
  * @param {DOMElement} target - The element to remove the highlight effect from
  * @param {DOMElement} opacity - The opacity to return the element to
  */
  removeHighlight: function(target, opacity, color) {
    target.style.opacity = opacity;
    target.style.color = color;
    target.style.WebkitFilter = "";
    target.style.filter = "";
    target.style.msFilter = "";
  },

  /**
  * Determine which buttons should be shown in the control bar given the width of the player<br/>
  * Note: items which do not meet the item spec will be removed and not appear in the results.
  *
  * @function collapse
  * @param {Number} barWidth - Width of the control bar
  * @param {Object[]} orderedItems - array of left to right ordered items. Each item meets the skin's "button" schema.
  * @returns {Object} An object of the structure {fit:[], overflow:[]} where the fit object is
  *   an array of buttons that fit in the control bar and overflow are the ones that should be hidden
  */
  collapse: function( barWidth, orderedItems, responsiveUIMultiple ) {
    if( isNaN( barWidth ) || barWidth === undefined ) { return orderedItems; }
    if( ! orderedItems ) { return []; }
    var self = this;
    var validItems = orderedItems.filter( function(item) { return self._isValid(item); } );
    var r = this._collapse( barWidth, validItems, responsiveUIMultiple );
    return r;
  },

  /**
  * Find thumbnail image URL and its index that correspond to given time value
  *
  * @function findThumbnail
  * @param {Object} thumbnails - metadata object containing information about thumbnails
  * @param {Number} hoverTime - time value to find thumbnail for
  * @param {Number} duration - duration of the video
  * @returns {Object} object that contains URL and index of requested thumbnail
  */
  findThumbnail: function(thumbnails, hoverTime, duration) {
    var timeSlices = thumbnails.data.available_time_slices;
    var width = thumbnails.data.available_widths[0]; //choosing the lowest size

    var position = Math.floor((hoverTime/duration) * timeSlices.length);
    position = Math.min(position, timeSlices.length - 1);
    position = Math.max(position, 0);

    var selectedTimeSlice = null;
    var selectedPosition = position;

    if (timeSlices[position] >= hoverTime) {
      selectedTimeSlice = timeSlices[0];
      for (var i = position; i >= 0; i--) {
        if (timeSlices[i] <= hoverTime) {
          selectedTimeSlice = timeSlices[i];
          selectedPosition = i;
          break;
        }
      }
    }
    else {
      selectedTimeSlice = timeSlices[timeSlices.length - 1];
      for (var i = position; i < timeSlices.length; i++) {
        if (timeSlices[i] > hoverTime) {
          selectedTimeSlice = timeSlices[i - 1];
          selectedPosition = i - 1;
          break;
        }
      }
    }

    var selectedThumbnail = thumbnails.data.thumbnails[selectedTimeSlice][width].url;
    return { url: selectedThumbnail, pos: selectedPosition };
  },

  reformatAspectRatio: function (aspectRatio) {
    var aspectRatioArray = aspectRatio.split(':');
    var vidWidth = aspectRatioArray[0];
    var vidHeight = aspectRatioArray[1];
    var dimensions = {};
    dimensions["width"] = vidWidth;
    dimensions["height"] = vidHeight;
    return dimensions;
  },

  /**
  * Check if the current browser is on a touch enabled device.
  * Function from https://hacks.mozilla.org/2013/04/detecting-touch-its-the-why-not-the-how/
  *
  * @function browserSupportsTouch
  * @returns {Boolean} Whether or not the browser supports touch events.
  */
  browserSupportsTouch: function() {
    return ('ontouchstart' in window) ||
     (navigator.maxTouchPoints > 0) ||
     (navigator.msMaxTouchPoints > 0);
  },

  _isValid: function( item ) {
    var valid = (
      item &&
      item.location == "moreOptions" ||
      (item.location == "controlBar" &&
        item.whenDoesNotFit &&
        item.minWidth !== undefined &&
        item.minWidth >= 0)
    );
    return valid;
  },

  _collapse: function( barWidth, orderedItems, responsiveUIMultiple ) {
    var r = { fit : orderedItems.slice(), overflow : [] };
    var usedWidth = orderedItems.reduce( function(p,c,i,a) { return p + responsiveUIMultiple * c.minWidth; }, 0 );
    for( var i = orderedItems.length-1; i >= 0; --i ) {
      var item = orderedItems[ i ];
      if( this._isOnlyInMoreOptions(item) ) {
        usedWidth = this._collapseLastItemMatching(r, item, usedWidth);
      }
      if( usedWidth > barWidth && this._isCollapsable(item) ) {
        usedWidth = this._collapseLastItemMatching(r, item, usedWidth);
      }
    }
    return r;
  },

  _isOnlyInMoreOptions: function( item ) {
    var must = item.location == "moreOptions";
    return must;
  },

  _isCollapsable: function( item ) {
    var collapsable = item.location == "controlBar" && item.whenDoesNotFit && item.whenDoesNotFit != "keep";
    return collapsable;
  },

  _collapseLastItemMatching: function( results, item, usedWidth ) {
    var i = results.fit.lastIndexOf( item );
    if( i > -1 ) {
      results.fit.splice( i, 1 );
      results.overflow.unshift( item );
      if( item.minWidth ) {
        usedWidth -= item.minWidth;
      }
    }
    return usedWidth;
  },

  _isOverflow: function( item ) {
    return item.whenDoesNotFit && item.whenDoesNotFit == "moveToMoreOptions";
  }
};
module.exports = Utils;

},{}],35:[function(require,module,exports){
/**
 * Panel component for video quality selection
 *
 * @module VideoQualityPanel
 */
var React = require('react'),
    ScrollArea = require('react-scrollbar/dist/no-css'),
    ClassNames = require('classnames'),
    Icon = require('../components/icon');

var VideoQualityPanel = React.createClass({displayName: "VideoQualityPanel",
  getInitialState: function() {
    return {
      selected: this.props.videoQualityOptions.selectedBitrate ? this.props.videoQualityOptions.selectedBitrate.id : 'auto'
    };
  },

  handleVideoQualityClick: function(selectedBitrateId, event) {
    event.preventDefault();
    var eventData = {
      "id": selectedBitrateId
    };
    this.props.controller.sendVideoQualityChangeEvent(eventData);
    this.setState({
      selected: selectedBitrateId
    });
    this.props.togglePopoverAction();
  },

  addAutoButton: function(bitrateButtons) {
    var autoQualityBtn = ClassNames({
      'oo-quality-auto-btn': true,
      'oo-selected': this.state.selected == 'auto'
    });

    //add auto btn to beginning of array
    bitrateButtons.unshift(
      React.createElement("li", {className: "oo-auto-li", key: "auto-li"}, 
        React.createElement("a", {className: autoQualityBtn, key: "auto", onClick: this.handleVideoQualityClick.bind(this, 'auto')}, 
          React.createElement("div", {className: "oo-quality-auto-icon"}, 
            React.createElement(Icon, React.__spread({},  this.props, {icon: "auto"}))
          ), 
          React.createElement("div", {className: "oo-quality-auto-label"}, "Auto")
        )
      )
    );
  },

  render: function() {
    var availableBitrates  = this.props.videoQualityOptions.availableBitrates;

    var bitrateButtons = [];

    //available bitrates
    for (var i = 0; i < availableBitrates.length; i++) {
      var qualityBtn = ClassNames({
        'oo-quality-btn': true,
        'oo-selected': this.state.selected == availableBitrates[i].id
      });

      if (availableBitrates[i].id == 'auto'){
        this.addAutoButton(bitrateButtons);
      }
      else {
        var label = Math.round(availableBitrates[i].bitrate/1000) + ' kbps';
        bitrateButtons.push(React.createElement("li", {key: i}, React.createElement("a", {className: qualityBtn, key: i, onClick: this.handleVideoQualityClick.bind(this, availableBitrates[i].id)}, label)));
      }
    }

    var qualityScreenClass = ClassNames({
      'oo-content-panel': !this.props.popover,
      'oo-quality-panel': !this.props.popover,
      'oo-quality-popover': this.props.popover,
      'oo-mobile-fullscreen': !this.props.popover && this.props.controller.state.isMobile && (this.props.controller.state.fullscreen || this.props.controller.state.isFullWindow)
    });

    return (
      React.createElement("div", {className: qualityScreenClass}, 
        React.createElement(ScrollArea, {
          className: "oo-quality-screen-content", 
          speed: this.props.popover ? 0.6 : 1, 
          horizontal: this.props.popover ? false : true}, 
          React.createElement("ul", null, 
            bitrateButtons
          )
        )
      )
    );
  }
});

VideoQualityPanel.propTypes = {
  videoQualityOptions: React.PropTypes.shape({
    availableBitrates: React.PropTypes.arrayOf(React.PropTypes.shape({
      id: React.PropTypes.string,
      bitrate: React.PropTypes.number,
      label: React.PropTypes.string
    }))
  }),
  togglePopoverAction: React.PropTypes.func,
  controller: React.PropTypes.shape({
    sendVideoQualityChangeEvent: React.PropTypes.func
  })
};

VideoQualityPanel.defaultProps = {
  popover: false,
  skinConfig: {
    icons: {
      quality:{fontStyleClass:'oo-icon oo-icon-topmenu-quality'}
    }
  },
  videoQualityOptions: {
    availableBitrates: []
  },
  togglePopoverAction: function(){},
  controller: {
    sendVideoQualityChangeEvent: function(a){}
  }
};

module.exports = VideoQualityPanel;

},{"../components/icon":22,"classnames":51,"react":212,"react-scrollbar/dist/no-css":56}],36:[function(require,module,exports){
/********************************************************************
  CONSTANT
*********************************************************************/
module.exports = {
  STATE: {
    START : "start",
    PLAYING : "playing",
    PAUSE : "pause",
    END : "end",
    ERROR : "error"
  },

  SCREEN: {
    START_SCREEN: "startScreen",
    PLAYING_SCREEN: "playingScreen",
    PAUSE_SCREEN: "pauseScreen",
    END_SCREEN: "endScreen",
    SHARE_SCREEN: "shareScreen",
    DISCOVERY_SCREEN: "discoveryScreen",
    UP_NEXT_SCREEN: "upNextScreen",
    AD_SCREEN: "adScreen",
    MORE_OPTIONS_SCREEN: "moreOptionsScreen",
    LOADING_SCREEN: "loadingScreen",
    CLOSEDCAPTION_SCREEN: "closedCaptionScreen",
    VIDEO_QUALITY_SCREEN: "videoQualityScreen",
    ERROR_SCREEN: "errorScreen"
  },

  SKIN_TEXT: {
    LEARN_MORE: "Learn More",
    CLOSED_CAPTION_PREVIEW: "CLOSED CAPTION PREVIEW",
    SAMPLE_TEXT: "Sample Text",
    AD: "Ad",
    SKIP_AD: "Skip Ad",
    LIVE: "LIVE",
    GO_LIVE: "GO LIVE",
    CC_OPTIONS: "CC Options",
    ON: "On",
    OFF: "Off",
    DISCOVER: "Discover",
    UP_NEXT: "Up next",
    VIDEO_QUALITY: "Video Quality",
    SHARE_CALL_TO_ACTION: "Invest In Social Change",
    SHARE: "Share",
    START_AT: "Start at",
    EMBED: "Embed",
    EMAIL: "Email",
    EMAIL_BODY: "Check out this video",
    TO: "To",
    SUBJECT: "Subject",
    MESSAGE: "Message",
    RECIPIENT: "name@email.com",
    OPTIONAL_MESSAGE: "Optional Message",
    SEND: "Send",
    ERROR_ACTION: "RELOAD YOUR SCREEN OR TRY SELECTING A DIFFERENT VIDEO",
    UNKNOWN_ERROR: "Something happened while we were trying to play your video! Click replay or simply reload your page.",
    LANGUAGE_TAB_TITLE: "Language",
    COLOR_SELECTION_TAB_TITLE: "Color Selection",
    CAPTION_OPACITY_TAB_TITLE: "Caption Opacity",
    FONT_TYPE_TAB_TITLE: "Font Type",
    FONT_SIZE_TAB_TITLE: "Font Size",
    TEXT_ENHANCEMENTS_TAB_TITLE: "Text Enhancements",
    TEXT_COLOR: "Text color",
    BACKGROUND_COLOR: "Background color",
    WINDOW_COLOR: "Window color",
    TRANSPARENT: "Transparent",
    WHITE: "White",
    BLUE: "Blue",
    MAGENTA: "Magenta",
    GREEN: "Green",
    YELLOW: "Yellow",
    RED: "Red",
    CYAN: "Cyan",
    BLACK: "Black",
    TEXT_OPACITY: "Text opacity",
    BACKGROUND_OPACITY: "Background opacity",
    WINDOW_OPACITY: "Window opacity",
    FONT_SIZE: "Font size",
    SMALL: "Small",
    MEDIUM: "Medium",
    LARGE: "Large",
    EXTRA_LARGE: "Extra Large",
    TEXT_ENHANCEMENT: "Text enhancement",
    UNIFORM: "Uniform",
    DEPRESSED: "Depressed",
    RAISED: "Raised",
    SHADOW: "Shadow"
  },

  KEYCODES: {
    SPACE_KEY: 32,
    LEFT_ARROW_KEY: 37,
    RIGHT_ARROW_KEY: 39,
    UP_ARROW_KEY: 38,
    DOWN_ARROW_KEY: 40,
    ESCAPE_KEY: 27
  },

  UI: {
    defaultScrubberBarHeight: 4,
    DEFAULT_SCRUBBERBAR_LEFT_RIGHT_PADDING: 15
  },

  AD_CLICK_SOURCE:{
    VIDEO_WINDOW: "videoWindow",
    LEARN_MORE_BUTTON: "learnMoreButton",
    OVERLAY: "overlay"
  },

  PAUSE_REASON: {
    TRANSITION: "transition"
  },

  ERROR_MESSAGE: {
    "network":{
      name: "OO.ERROR.API.NETWORK",
      title: "NETWORK ERROR",
      description: "Cannot Contact Server"
    },
    "sas":{
      name: "OO.ERROR.API.SAS.GENERIC",
      title: "SAS ERROR",
      description: "Invalid Authorization Response"
    },
    "geo":{
      name: "OO.ERROR.API.SAS.GEO",
      title: "SAS GEO ERROR",
      description: "This video is not authorized in your location"
    },
    "domain":{
      name: "OO.ERROR.API.SAS.DOMAIN",
      title: "SAS DOMAIN ERROR",
      description: "This video is not authorized for your domain"
    },
    "future":{
      name: "OO.ERROR.API.SAS.FUTURE",
      title: "VIDEO NOT AVAILABLE YET",
      description: "This video will be available soon"
    },
    "past":{
      name: "OO.ERROR.API.SAS.PAST",
      title: "VIDEO NO LONGER AVAILABLE",
      description: "This video is no longer available"
    },
    "device":{
      name: "OO.ERROR.API.SAS.DEVICE",
      title: "SAS DEVICE ERROR",
      description: "This video is not authorized for playback on this device"
    },
    "proxy":{
      name: "OO.ERROR.API.SAS.PROXY",
      title: "SAS PROXY ERROR",
      description: "An anonymous proxy was detected. Please disable the proxy and retry."
    },
    "concurrent_streams":{
      name: "OO.ERROR.API.SAS.CONCURRENT_STREAMS",
      title: "CONCURRENT STREAMS NUMBER EXCEEDED",
      description: "You have exceeded the maximum number of concurrent streams"
    },
    "device_binding_failed":{
      name: "OO.ERROR.API.SAS.ERROR.DEVICE_BINDING_FAILED",
      title: "DEVICE BINDING ERROR",
      description: "Device binding failed"
    },
    "device_id_too_long":{
      name: "OO.ERROR.API.SAS.ERROR.DEVICE_ID_TOO_LONG",
      title: "DEVICE ID TOO LONG",
      description: "Device ID is too long"
    },
    "device_invalid_auth_token":{
      name: "OO.ERROR.API.SAS.ERROR.DEVICE_INVALID_AUTH_TOKEN",
      title: "INVALID PLAYER TOKEN",
      description: "Invalid Ooyala Player token"
    },
    "device_limit_reached":{
      name: "OO.ERROR.API.SAS.ERROR.DEVICE_LIMIT_REACHED",
      title: "DEVICE LIMIT REACHED",
      description: "Device limit has been reached"
    },
    "drm_general_failure":{
      name: "OO.ERROR.API.SAS.ERROR_DRM_GENERAL_FAILURE",
      title: "LICENSE ERROR",
      description: "General error acquiring license"
    },
    "drm_server_error":{
      name: "OO.ERROR.API.SAS.ERROR_DRM_RIGHTS_SERVER_ERROR",
      title: "DRM SERVER ERROR",
      description: "DRM server error"
    },
    "invalid_entitlements":{
      name: "OO.ERROR.API.SAS.ERROR_INVALID_ENTITLEMENTS",
      title: "INVALID ENTITLEMENTS ERROR",
      description: "User Entitlement Terminated - Stream No Longer Active for the User"
    },
    "invalid_heartbeat":{
      name: "OO.ERROR.API.SAS.INVALID_HEARTBEAT",
      title: "INVALID HEARTBEAT",
      description: "Invalid heartbeat response"
    },
    "content_tree":{
      name: "OO.ERROR.API.CONTENT_TREE",
      title: "INVALID CONTENT",
      description: "Invalid Content"
    },
    "metadata":{
      name: "OO.ERROR.API.METADATA",
      title: "INVALID METADATA",
      description: "Invalid Metadata"
    },
    "playback":{
      name: "OO.ERROR.PLAYBACK.GENERIC",
      title: "PLAYBACK ERROR",
      description: "Could not play the content"
    },
    "stream":{
      name: "OO.ERROR.PLAYBACK.STREAM",
      title: "PLAYBACK STREAM ERROR",
      description: "This video isn't encoded for your device"
    },
    "livestream":{
      name: "OO.ERROR.PLAYBACK.LIVESTREAM",
      title: "PLAYBACK LIVESTREAM ERROR",
      description: "Live stream is off air"
    },
    "network_error":{
      name: "OO.ERROR.PLAYBACK.NETWORK",
      title: "PLAYBACK NETWORK ERROR",
      description: "Network connection temporarily lost"
    },
    "unplayable_content":{
      name: "OO.ERROR.UNPLAYABLE_CONTENT",
      title: "UNPLAYABLE CONTENT ERROR",
      description: "This video is not playable on this player"
    },
    "invalid_external_id":{
      name: "OO.ERROR.INVALID.EXTERNAL_ID",
      title: "INVALID EXTERNAL ID",
      description: "Invalid External ID"
    },
    "empty_channel":{
      name: "OO.ERROR.EMPTY_CHANNEL",
      title: "EMPTY CHANNEL ERROR",
      description: "This channel is empty"
    },
    "empty_channel_set":{
      name: "OO.ERROR.EMPTY_CHANNEL_SET",
      title: "EMPTY CHANNEL SET ERROR",
      description: "This channel set is empty"
    },
    "channel_content":{
      name: "OO.ERROR.CHANNEL_CONTENT",
      title: "CHANNEL CONTENT ERROR",
      description: "This channel is not playable at this time"
    },
    "unsupported_encoding":{
      name: "OO.ERROR.VC.UNSUPPORTED_ENCODING",
      description: "Something happened while we were trying to play your video! Click replay or simply reload your page."
    },
    "unable_to_create_video_element":{
      name: "OO.ERROR.VC.UNABLE_TO_CREATE_VIDEO_ELEMENT",
      description: "Something happened while we were trying to play your video! Click replay or simply reload your page."
    }
  }
}

},{}],37:[function(require,module,exports){
/********************************************************************
 CONTROLLER
 *********************************************************************/
var React = require('react'),
    ReactDOM = require('react-dom'),
    Utils = require('./components/utils'),
    CONSTANTS = require('./constants/constants'),
    AccessibilityControls = require('./components/accessibilityControls'),
    Fullscreen = require('screenfull'),
    Skin = require('./skin');

OO.plugin("Html5Skin", function (OO, _, $, W) {
  //Check if the player is at least v4. If not, the skin cannot load.
  if (!OO.playerParams.core_version || OO.playerParams.core_version <= 3) {
    console.error("Html5Skin requires at least player version 4.");
    return null;
  }

  if (OO.publicApi && OO.publicApi.VERSION) {
    // This variable gets filled in by the build script
    OO.publicApi.VERSION.skin = {"releaseVersion": "4.6.9", "rev": "d7d395484223154cc3f86a7977302a5dca496364"};
  }

  var Html5Skin = function (mb, id) {
    this.mb = mb;
    this.id = id;
    this.state = {
      "playerParam": {},
      "persistentSettings": {
        "closedCaptionOptions": {}
      },
      "assetId": null,
      "contentTree": {},
      "thumbnails": null,
      "isLiveStream": false,
      "screenToShow": null,
      "playerState": null,
      "discoveryData": null,
      "isPlayingAd": false,
      "adOverlayUrl": null,
      "showAdOverlay": false,
      "showAdOverlayCloseButton": false,
      "showAdControls": true,
      "showAdMarquee": true,
      "configLoaded": false,
      "config": {},
      "fullscreen": false,
      "pauseAnimationDisabled": false,
      "adPauseAnimationDisabled": true,
      "pausedCallback": null,
      "seeking": false,
      "queuedPlayheadUpdate": null,
      "accessibilityControlsEnabled": false,
      "duration": 0,
      "mainVideoDuration": 0,
      "adVideoDuration": 0,
      "adStartTime": 0,
      "elementId": null,
      "mainVideoContainer": null,
      "mainVideoInnerWrapper": null,
      "mainVideoElement": null,
      "mainVideoAspectRatio": 0,
      "pluginsElement": null,
      "pluginsClickElement": null,
      "buffering": false,
      "mainVideoPlayhead": null,
      "focusedElement": null,

      "currentAdsInfo": {
        "currentAdItem": null,
        "numberOfAds": 0,
        "skipAdButtonEnabled": false
      },

      "closedCaptionOptions": {
        "enabled": null,
        "language": null,
        "availableLanguages": null,
        "cueText": null,
        "showClosedCaptionPopover": false,
        "textColor": null,
        "windowColor": null,
        "backgroundColor": null,
        "textOpacity": null,
        "backgroundOpacity": null,
        "windowOpacity": null,
        "fontType": null,
        "fontSize": null,
        "textEnhancement": null
      },

      "videoQualityOptions": {
        "availableBitrates": null,
        "selectedBitrate": null,
        "showVideoQualityPopover":false
      },

      "volumeState": {
        "volume": 1,
        "muted": false,
        "oldVolume": 1,
        "volumeSliderVisible": false
      },

      "upNextInfo": {
        "upNextData": null,
        "countDownFinished": false,
        "countDownCancelled": false,
        "timeToShow": 0,
        "showing": false,
        "delayedSetEmbedCodeEvent": false,
        "delayedContentData": null
      },

      "moreOptionsItems": null,

      "isMobile": false,
      "controlBarVisible": true,
      "forceControlBarVisible": false,
      "timer": null,
      "errorCode": null,
      "isSubscribed": false,
      "isPlaybackReadySubscribed": false,
      "isSkipAdClicked": false,
      "isInitialPlay": false,
      "isFullScreenSupported": false,
      "isVideoFullScreenSupported": false,
      "isFullWindow": false
    };

    this.init();
  };

  Html5Skin.prototype = {
    init: function () {
      // player events
      this.mb.subscribe(OO.EVENTS.PLAYER_CREATED, 'customerUi', _.bind(this.onPlayerCreated, this));
      this.mb.subscribe(OO.EVENTS.VC_VIDEO_ELEMENT_CREATED, 'customerUi', _.bind(this.onVcVideoElementCreated, this));
      this.mb.subscribe(OO.EVENTS.DESTROY, 'customerUi', _.bind(this.onPlayerDestroy, this));
      this.mb.subscribe(OO.EVENTS.EMBED_CODE_CHANGED, 'customerUi', _.bind(this.onEmbedCodeChanged, this));
      this.mb.subscribe(OO.EVENTS.CONTENT_TREE_FETCHED, 'customerUi', _.bind(this.onContentTreeFetched, this));
      this.mb.subscribe(OO.EVENTS.THUMBNAILS_FETCHED, 'customerUi', _.bind(this.onThumbnailsFetched, this));//xenia: to be replaced by a more appropriate event
      this.mb.subscribe(OO.EVENTS.AUTHORIZATION_FETCHED, 'customerUi', _.bind(this.onAuthorizationFetched, this));
      this.mb.subscribe(OO.EVENTS.ASSET_CHANGED, 'customerUi', _.bind(this.onAssetChanged, this));
      this.mb.subscribe(OO.EVENTS.PLAYBACK_READY, 'customerUi', _.bind(this.onPlaybackReady, this));
      this.mb.subscribe(OO.EVENTS.ERROR, "customerUi", _.bind(this.onErrorEvent, this));
      this.mb.addDependent(OO.EVENTS.PLAYBACK_READY, OO.EVENTS.UI_READY);
      this.state.isPlaybackReadySubscribed = true;
    },

    subscribeBasicPlaybackEvents: function () {
      if(!this.state.isSubscribed) {
        this.mb.subscribe(OO.EVENTS.SEND_QUALITY_CHANGE, 'customerUi', _.bind(this.receiveVideoQualityChangeEvent, this));
        this.mb.subscribe(OO.EVENTS.INITIAL_PLAY, 'customerUi', _.bind(this.onInitialPlay, this));
        this.mb.subscribe(OO.EVENTS.VC_PLAYED, 'customerUi', _.bind(this.onVcPlayed, this));
        this.mb.subscribe(OO.EVENTS.VC_PLAYING, 'customerUi', _.bind(this.onPlaying, this));
        this.mb.subscribe(OO.EVENTS.VC_PAUSED, 'customerUi', _.bind(this.onPaused, this));
        this.mb.subscribe(OO.EVENTS.VC_PAUSE, 'customerUi', _.bind(this.onPause, this));
        this.mb.subscribe(OO.EVENTS.PLAYED, 'customerUi', _.bind(this.onPlayed, this));
        this.mb.subscribe(OO.EVENTS.PLAYHEAD_TIME_CHANGED, 'customerUi', _.bind(this.onPlayheadTimeChanged, this));
        this.mb.subscribe(OO.EVENTS.SEEKED, 'customerUi', _.bind(this.onSeeked, this));
        this.mb.subscribe(OO.EVENTS.BUFFERING, 'customerUi', _.bind(this.onBuffering, this));
        this.mb.subscribe(OO.EVENTS.BUFFERED, 'customerUi', _.bind(this.onBuffered, this));
        this.mb.subscribe(OO.EVENTS.CLOSED_CAPTIONS_INFO_AVAILABLE, "customerUi", _.bind(this.onClosedCaptionsInfoAvailable, this));
        this.mb.subscribe(OO.EVENTS.BITRATE_INFO_AVAILABLE, "customerUi", _.bind(this.onBitrateInfoAvailable, this));
        this.mb.subscribe(OO.EVENTS.CLOSED_CAPTION_CUE_CHANGED, "customerUi", _.bind(this.onClosedCaptionCueChanged, this));
        this.mb.subscribe(OO.EVENTS.VOLUME_CHANGED, "customerUi", _.bind(this.onVolumeChanged, this));
        this.mb.subscribe(OO.EVENTS.VC_VIDEO_ELEMENT_IN_FOCUS, "customerUi", _.bind(this.onVideoElementFocus, this));
        this.mb.subscribe(OO.EVENTS.REPLAY, "customerUi", _.bind(this.onReplay, this));
        this.mb.subscribe(OO.EVENTS.ASSET_DIMENSION, "customerUi", _.bind(this.onAssetDimensionsReceived, this));
        // PLAYBACK_READY is a fundamental event in the init process that can be unsubscribed by errors.
        // If and only if such has occured, it needs a route to being resubscribed.
        if(!this.state.isPlaybackReadySubscribed) {
          this.mb.subscribe(OO.EVENTS.PLAYBACK_READY, 'customerUi', _.bind(this.onPlaybackReady, this));
        }

        // ad events
        if (!Utils.isIPhone()) {
          //since iPhone is always playing in full screen and not showing our skin, don't need to render skin
          this.mb.subscribe(OO.EVENTS.ADS_PLAYED, "customerUi", _.bind(this.onAdsPlayed, this));
          this.mb.subscribe(OO.EVENTS.WILL_PLAY_ADS , "customerUi", _.bind(this.onWillPlayAds, this));
          this.mb.subscribe(OO.EVENTS.AD_POD_STARTED, "customerUi", _.bind(this.onAdPodStarted, this));
          this.mb.subscribe(OO.EVENTS.WILL_PLAY_SINGLE_AD , "customerUi", _.bind(this.onWillPlaySingleAd, this));
          this.mb.subscribe(OO.EVENTS.SINGLE_AD_PLAYED , "customerUi", _.bind(this.onSingleAdPlayed, this));
          this.mb.subscribe(OO.EVENTS.PLAY_NONLINEAR_AD, "customerUi", _.bind(this.onPlayNonlinearAd, this));
          this.mb.subscribe(OO.EVENTS.NONLINEAR_AD_PLAYED, "customerUi", _.bind(this.closeNonlinearAd, this));
          this.mb.subscribe(OO.EVENTS.HIDE_NONLINEAR_AD, "customerUi", _.bind(this.hideNonlinearAd, this));
          this.mb.subscribe(OO.EVENTS.SHOW_NONLINEAR_AD, "customerUi", _.bind(this.showNonlinearAd, this));
          this.mb.subscribe(OO.EVENTS.SHOW_NONLINEAR_AD_CLOSE_BUTTON, "customerUi", _.bind(this.showNonlinearAdCloseButton, this));
          this.mb.subscribe(OO.EVENTS.SHOW_AD_SKIP_BUTTON, "customerUi", _.bind(this.onShowAdSkipButton, this));
          this.mb.subscribe(OO.EVENTS.SHOW_AD_CONTROLS, "customerUi", _.bind(this.onShowAdControls, this));
          this.mb.subscribe(OO.EVENTS.SHOW_AD_MARQUEE, "customerUi", _.bind(this.onShowAdMarquee, this));
        }
      }
      this.state.isSubscribed = true;
    },

    externalPluginSubscription: function() {
      if (OO.EVENTS.DISCOVERY_API) {
        this.mb.subscribe(OO.EVENTS.DISCOVERY_API.RELATED_VIDEOS_FETCHED, "customerUi", _.bind(this.onRelatedVideosFetched, this));
      }
    },

    /*--------------------------------------------------------------------
     event listeners from core player -> regulate skin STATE
     ---------------------------------------------------------------------*/
    onPlayerCreated: function (event, elementId, params, settings) {
      //set state variables
      this.state.mainVideoContainer = $("#" + elementId);
      this.state.mainVideoInnerWrapper = $("#" + elementId + " .innerWrapper");
      this.state.playerParam = params;
      this.state.elementId = elementId;
      this.state.isMobile = Utils.isMobile();
      this.state.browserSupportsTouch = Utils.browserSupportsTouch();

      //initial DOM manipulation
      this.state.mainVideoContainer.addClass('oo-player-container');
      this.state.mainVideoInnerWrapper.addClass('oo-player');
      this.state.mainVideoInnerWrapper.append("<div class='oo-player-skin'></div>");

      var tmpLocalizableStrings = {};

      // Would be a good idea to also (or only) wait for skin metadata to load. Load metadata here
      $.getJSON(params.skin.config, _.bind(function(data) {
        //override data in skin config with possible inline data input by the user
        $.extend(true, data, params.skin.inline);
        //override state settings with defaults from skin config and possible local storage settings
        $.extend(true, this.state.closedCaptionOptions, data.closedCaptionOptions, settings.closedCaptionOptions);

        //load language jsons
        data.localization.availableLanguageFile.forEach(function(languageObj){
          $.getJSON(languageObj.languageFile, _.bind(function(data) {
            tmpLocalizableStrings[languageObj.language] = data;
            this.renderSkin();
          }, this));
        }, this);

        this.state.config = data;

        this.skin = ReactDOM.render(
          React.createElement(Skin, {skinConfig: data, localizableStrings: tmpLocalizableStrings, language: Utils.getLanguageToUse(data), controller: this, closedCaptionOptions: this.state.closedCaptionOptions, pauseAnimationDisabled: this.state.pauseAnimationDisabled}), document.querySelector("#" + this.state.elementId + " .oo-player-skin")
        );
        var accessibilityControls = new AccessibilityControls(this); //keyboard support
        this.state.configLoaded = true;
        this.renderSkin();

        var fullClass = (this.state.config.adScreen.showControlBar ? "" : " oo-full");
        $("#" + this.state.elementId + " .oo-player-skin").append("<div class='oo-player-skin-plugins"+fullClass+"'></div><div class='oo-player-skin-plugins-click-layer"+fullClass+"'></div>");
        this.state.pluginsElement = $("#" + this.state.elementId + " .oo-player-skin-plugins");
        this.state.pluginsClickElement = $("#" + this.state.elementId + " .oo-player-skin-plugins-click-layer");
        this.state.pluginsElement.mouseover(
          function() {
            this.showControlBar();
            this.renderSkin();
            this.startHideControlBarTimer();
          }.bind(this)
        );
        this.state.pluginsElement.mouseout(
          function() {
            this.hideControlBar();
          }.bind(this)
        );
        this.state.pluginsClickElement.click(
          function() {
            this.state.pluginsClickElement.removeClass("oo-showing");
            this.mb.publish(OO.EVENTS.PLAY);
          }.bind(this)
        );
        this.state.pluginsClickElement.mouseover(
          function() {
            this.showControlBar();
            this.renderSkin();
            this.startHideControlBarTimer();
          }.bind(this)
        );
        this.state.pluginsClickElement.mouseout(
          function() {
            this.hideControlBar();
          }.bind(this)
        );
        this.mb.publish(OO.EVENTS.UI_READY, {
          videoWrapperClass: "innerWrapper",
          pluginsClass: "oo-player-skin-plugins"
        });
      }, this));

      this.state.isMobile = Utils.isMobile();

      this.externalPluginSubscription();
      this.state.screenToShow = CONSTANTS.SCREEN.LOADING_SCREEN;
    },

    onVcVideoElementCreated: function(eventname, params) {
      var element = $("#" + params["domId"]);
      var elementVideo = element.find("video");

      //if video element is descendant
      if (elementVideo.length) {
        element = elementVideo;
      }

      //add loadedmetadata event listener to main video element
      if (element.get(0)) {
        element.get(0).addEventListener("loadedmetadata", this.metaDataLoaded.bind(this));
      }

      if (Utils.isIE10()) {
        element.attr("controls", "controls");
      }

      if (params["videoId"] === OO.VIDEO.MAIN) {
        this.state.mainVideoElement = element;
        this.enableFullScreen();
        this.updateAspectRatio();
      }
    },

    // functions dependent on video metadata
    metaDataLoaded: function () {
      this.enableIosFullScreen();
    },

    onPlayerDestroy: function (event) {
      var elementId = this.state.elementId;
      var mountNode = document.querySelector('#' + elementId + ' .oo-player-skin');
      // remove mounted Skin component
      ReactDOM.unmountComponentAtNode(mountNode);
      this.mb = null;
    },

    onEmbedCodeChanged: function(event, embedCode, options) {
      this.state.videoQualityOptions.availableBitrates = null;
      this.state.videoQualityOptions.selectedBitrate = null;
      this.state.closedCaptionOptions.availableLanguages = null;
      this.state.discoveryData = null;
      this.state.thumbnails = null;
      this.resetUpNextInfo(true);

      this.state.assetId = embedCode;
      $.extend(true, this.state.playerParam, options);
      this.subscribeBasicPlaybackEvents();
    },

    onAuthorizationFetched: function(event, authorization) {
      this.state.isLiveStream = authorization.streams[0].is_live_stream;
    },

    onContentTreeFetched: function (event, contentTree) {
      this.state.contentTree = contentTree;
      this.state.playerState = CONSTANTS.STATE.START;
      this.renderSkin({"contentTree": contentTree});
    },

    onThumbnailsFetched: function (event, thumbnails) {
      this.state.thumbnails = thumbnails;
    },

    onAssetChanged: function (event, asset) {
      this.state.videoQualityOptions.availableBitrates = null;
      this.state.closedCaptionOptions.availableLanguages = null;
      this.state.discoveryData = null;
      this.subscribeBasicPlaybackEvents();

      this.resetUpNextInfo(true);

      this.state.isLiveStream = asset.content.streams[0].is_live_stream;

      var contentTree  = {};
      contentTree.title = asset.content.title;
      contentTree.description = asset.content.description;
      contentTree.duration = asset.content.duration;
      contentTree.promo_image = asset.content.posterImages[0].url;

      this.state.contentTree = contentTree;
      this.state.playerState = CONSTANTS.STATE.START;
      this.renderSkin({"contentTree": contentTree});
    },

    onVolumeChanged: function (event, newVolume){
      this.state.volumeState.volume = newVolume;
    },

    resetUpNextInfo: function (purge) {
      if (purge) {
        this.state.upNextInfo.upNextData = null;
      }
      this.state.upNextInfo.countDownFinished = false;
      this.state.upNextInfo.countDownCancelled = false;
    },

    onPlayheadTimeChanged: function(event, currentPlayhead, duration, buffered, startEnd, videoId) {
      if (videoId == "main") {
        this.state.mainVideoPlayhead = currentPlayhead;
      }
      else if (videoId == OO.VIDEO.ADS) {
        //adVideoDuration is only used in adPanel ad marquee
        this.state.adVideoDuration = duration;
      }
      // The code inside if statement is only for up next, however, up next does not apply to Ad screen.
      // So we only need to update the playhead for ad screen.
      this.state.duration = duration;
      if (this.state.screenToShow !== CONSTANTS.SCREEN.AD_SCREEN ) {
        if (this.skin.props.skinConfig.upNext.showUpNext) {
          if (!(Utils.isIPhone() || (Utils.isIos() && this.state.fullscreen))){//no UpNext for iPhone or fullscreen iPad
            this.showUpNextScreenWhenReady(currentPlayhead, duration);
          }
        } else if (this.state.playerState === CONSTANTS.STATE.PLAYING) {
          this.state.screenToShow = CONSTANTS.SCREEN.PLAYING_SCREEN;
        } else if (this.state.playerState === CONSTANTS.STATE.PAUSE) {
          this.state.screenToShow = CONSTANTS.SCREEN.PAUSE_SCREEN;
        }
      }
      if (!this.state.seeking) {
        this.skin.updatePlayhead(currentPlayhead, duration, buffered);
      } else {
        this.state.queuedPlayheadUpdate = [currentPlayhead, duration, buffered];
      }
    },

    showUpNextScreenWhenReady: function(currentPlayhead, duration) {
      var timeToShow = 0;
      var stringTimeToShow = this.skin.props.skinConfig.upNext.timeToShow;

      if (stringTimeToShow.indexOf('%') === -1){
        // time to show is based on seconds from the end
        timeToShow = parseInt(stringTimeToShow);
      } else {
        // time to show is based on percentage of duration from the beginning
        timeToShow = (1 - parseInt(stringTimeToShow)/100) * duration;
      }
      this.state.upNextInfo.timeToShow = timeToShow;

      if (duration !==0 &&
        duration - currentPlayhead <= timeToShow &&
        !this.state.upNextInfo.countDownCancelled &&
        this.state.isPlayingAd !== true &&
        this.state.upNextInfo.upNextData !== null && (this.state.playerState === CONSTANTS.STATE.PLAYING || this.state.playerState === CONSTANTS.STATE.PAUSE)) {
        this.state.upNextInfo.showing = true;
      }
      else {
        this.state.upNextInfo.showing = false;
      }
    },

    onInitialPlay: function() {
      this.state.isInitialPlay = true;
    },

    onPlaying: function(event, source) {
      if (source == OO.VIDEO.MAIN) {
        this.state.pauseAnimationDisabled = false;
        this.state.screenToShow = CONSTANTS.SCREEN.PLAYING_SCREEN;
        this.state.playerState = CONSTANTS.STATE.PLAYING;
        this.setClosedCaptionsLanguage();
        this.state.mainVideoElement.removeClass('oo-blur');
        this.state.isInitialPlay = false;
        this.renderSkin();
      }
      if (source == OO.VIDEO.ADS) {
        this.state.buffering = false;
        this.state.adPauseAnimationDisabled = true;
        this.state.pluginsElement.addClass("oo-showing");
        this.state.pluginsClickElement.removeClass("oo-showing");
        if (this.state.currentAdsInfo.currentAdItem !== null) {
          this.state.playerState = CONSTANTS.STATE.PLAYING;
          //Set the screen to ad screen in case current screen does not involve video playback, such as discovery
          this.state.screenToShow = CONSTANTS.SCREEN.AD_SCREEN;
          this.renderSkin();
        }
      }
    },

    onPause: function(event, source, pauseReason) {
      if (pauseReason === CONSTANTS.PAUSE_REASON.TRANSITION){
        this.state.pauseAnimationDisabled = true;
        this.endSeeking();
      }
      // If an ad using the custom ad element has issued a pause, activate the click layer
      if (source == OO.VIDEO.ADS && this.state.pluginsElement.children().length > 0) {
        this.state.pluginsClickElement.addClass("oo-showing");
      }
    },

    onPaused: function(eventname, videoId) {
      if (videoId != this.focusedElement || this.state.screenToShow == CONSTANTS.SCREEN.END_SCREEN) { return; }
      if (videoId == OO.VIDEO.MAIN && this.state.screenToShow != CONSTANTS.SCREEN.AD_SCREEN && this.state.screenToShow != CONSTANTS.SCREEN.LOADING_SCREEN) {
        if (this.state.duration - this.state.mainVideoPlayhead < 0.01) { //when video ends, we get paused event before played event
          this.state.pauseAnimationDisabled = true;
        }
        if (this.state.pauseAnimationDisabled == false && this.state.discoveryData && this.skin.props.skinConfig.pauseScreen.screenToShowOnPause === "discovery"
            && !(Utils.isIPhone() || (Utils.isIos() && this.state.fullscreen))) {
          OO.log("Should display DISCOVERY_SCREEN on pause");
          this.sendDiscoveryDisplayEvent("pauseScreen");
          this.state.screenToShow = CONSTANTS.SCREEN.DISCOVERY_SCREEN;
        } else if (this.skin.props.skinConfig.pauseScreen.screenToShowOnPause === "social") {
          // Remove this comment once pause screen implemented
        } else {
          // default
          this.state.screenToShow = CONSTANTS.SCREEN.PAUSE_SCREEN;
        }
        if (Utils.isIPhone()){
          //iPhone pause screen is the same as start screen
          this.state.screenToShow = CONSTANTS.SCREEN.PAUSE_SCREEN;
        }
        this.state.playerState = CONSTANTS.STATE.PAUSE;
        this.state.mainVideoElement.addClass('oo-blur');
        this.renderSkin();
      }
      else if (videoId == OO.VIDEO.ADS){
        this.state.adPauseAnimationDisabled = false;
        this.state.playerState = CONSTANTS.STATE.PAUSE;
        this.renderSkin();
      }
      if (this.pausedCallback) {
        this.pausedCallback();
        this.pausedCallback = null;
      }
    },

    onPlayed: function() {
      var duration = this.state.mainVideoDuration;
      this.state.duration = duration;
      this.skin.updatePlayhead(duration, duration, duration);

      if (this.state.upNextInfo.delayedSetEmbedCodeEvent) {
        var delayedContentData = this.state.upNextInfo.delayedContentData;
        this.state.screenToShow = CONSTANTS.SCREEN.LOADING_SCREEN;

        if (delayedContentData.clickedVideo.embed_code){
          this.mb.publish(OO.EVENTS.SET_EMBED_CODE, delayedContentData.clickedVideo.embed_code, this.state.playerParam);
        }
        else if (delayedContentData.clickedVideo.asset){
          this.mb.publish(OO.EVENTS.SET_ASSET, delayedContentData.clickedVideo.asset, this.state.playerParam);
        }

        this.mb.publish(OO.EVENTS.DISCOVERY_API.SEND_CLICK_EVENT, delayedContentData);
        this.state.upNextInfo.delayedSetEmbedCodeEvent = false;
        this.state.upNextInfo.delayedContentData = null;
      }
      else if (this.state.discoveryData && this.skin.props.skinConfig.endScreen.screenToShowOnEnd === "discovery"
               && !(Utils.isIPhone() || (Utils.isIos() && this.state.fullscreen))) {
        OO.log("Should display DISCOVERY_SCREEN on end");
        this.sendDiscoveryDisplayEvent("endScreen");
        this.state.screenToShow = CONSTANTS.SCREEN.DISCOVERY_SCREEN;
      } else if (this.skin.props.skinConfig.endScreen.screenToShowOnEnd === "share") {
        this.state.screenToShow = CONSTANTS.SCREEN.SHARE_SCREEN;
      } else {
        this.state.screenToShow = CONSTANTS.SCREEN.END_SCREEN;
        this.mb.publish(OO.EVENTS.END_SCREEN_SHOWN);
      }
      if (Utils.isIPhone()){
        //iPhone end screen is the same as start screen, except for the replay button
        this.state.screenToShow = CONSTANTS.SCREEN.START_SCREEN;
      }
      this.skin.updatePlayhead(this.state.duration, this.state.duration, this.state.duration);
      this.state.playerState = CONSTANTS.STATE.END;
      this.renderSkin();
    },

    onVcPlayed: function(event, source) {
      this.onBuffered();
      if (source == OO.VIDEO.MAIN) {
        var language = "";
        var mode = 'disabled';
        this.mb.publish(OO.EVENTS.SET_CLOSED_CAPTIONS_LANGUAGE, language, {"mode": mode});
        this.state.mainVideoDuration = this.state.duration;
      }
    },

    onSeeked: function(event) {
      this.state.seeking = false;
      if (this.state.queuedPlayheadUpdate) {
        OO.log("popping queued update");
        this.skin.updatePlayhead.apply(this.skin, this.state.queuedPlayheadUpdate);
        this.state.queuedPlayheadUpdate = null;
        this.renderSkin();
      }
      if (Utils.isIos() && this.state.screenToShow == CONSTANTS.SCREEN.END_SCREEN && this.state.fullscreen) {
        this.state.pauseAnimationDisabled = true;
        this.state.screenToShow = CONSTANTS.SCREEN.PAUSE_SCREEN;
        this.state.playerState = CONSTANTS.STATE.PAUSE;
      }
    },

    onPlaybackReady: function(event) {
      this.state.screenToShow = CONSTANTS.SCREEN.START_SCREEN;
      this.renderSkin({"contentTree": this.state.contentTree});
    },

    onBuffering: function(event) {
      if (this.state.isInitialPlay == false && this.state.screenToShow == CONSTANTS.SCREEN.START_SCREEN) {
        this.state.buffering = false;
      } else {
        this.state.buffering = true;
      }
      this.renderSkin();
    },

    onBuffered: function(event) {
      if (this.state.buffering === true) {
        this.state.buffering = false;
        this.renderSkin();
      }
    },

    onReplay: function(event) {
      this.resetUpNextInfo(false);
    },

    onAssetDimensionsReceived: function(event, params) {
      if (params.videoId == OO.VIDEO.MAIN && (this.skin.props.skinConfig.responsive.aspectRatio == "auto" || !this.skin.props.skinConfig.responsive.aspectRatio)) {
        this.state.mainVideoAspectRatio = this.calculateAspectRatio(params.width, params.height);
        this.setAspectRatio();
      }
    },

    /********************************************************************
      ADS RELATED EVENTS
    *********************************************************************/

    onAdsPlayed: function(event) {
      OO.log("onAdsPlayed is called from event = " + event);
      this.state.screenToShow = CONSTANTS.SCREEN.PLAYING_SCREEN;
      this.skin.updatePlayhead(this.skin.state.currentPlayhead, this.state.mainVideoDuration, this.skin.state.buffered);
      this.state.isPlayingAd = false;
      this.state.pluginsElement.removeClass("oo-showing");
      this.state.pluginsClickElement.removeClass("oo-showing");
      this.renderSkin();
    },

    onWillPlayAds: function(event) {
      OO.log("onWillPlayAds is called from event = " + event);
      this.state.isPlayingAd = true;
      this.state.pluginsElement.addClass("oo-showing");
      this.state.pluginsElement.css({
        height: "",
        width: ""
      });
      this.state.forceControlBarVisible = (this.state.pluginsElement.children().length > 0);
    },

    onAdPodStarted: function(event, numberOfAds) {
      OO.log("onAdPodStarted is called from event = " + event + "with " + numberOfAds + "ads");
      this.state.currentAdsInfo.numberOfAds = numberOfAds;
      this.renderSkin();
    },

    onWillPlaySingleAd: function(event, adItem) {
      OO.log("onWillPlaySingleAd is called with adItem = " + adItem);
      if (adItem !== null) {
        this.state.adVideoDuration = adItem.duration;
        this.state.screenToShow = CONSTANTS.SCREEN.AD_SCREEN;
        this.state.isPlayingAd = true;
        this.state.currentAdsInfo.currentAdItem = adItem;
        this.state.playerState = CONSTANTS.STATE.PLAYING;
        if (adItem.isLive) {
          this.state.adStartTime = new Date().getTime();
        } else {
          this.state.adStartTime = 0;
        }
        this.skin.state.currentPlayhead = 0;
        this.state.mainVideoElement.removeClass('oo-blur');
        this.renderSkin();
      }
    },

    onSingleAdPlayed: function(event) {
      OO.log("onSingleAdPlayed is called");
      this.state.isPlayingAd = false;
      this.state.adVideoDuration = 0;
      this.state.currentAdsInfo.skipAdButtonEnabled = false;
    },

    onShowAdSkipButton: function(event) {
      this.state.currentAdsInfo.skipAdButtonEnabled = true;
      this.renderSkin();
    },

    onShowAdControls: function(event, showAdControls) {
      this.state.showAdControls = showAdControls;
      if (showAdControls && this.state.config.adScreen.showControlBar) {
        this.state.pluginsElement.removeClass("oo-full");
        this.state.pluginsClickElement.removeClass("oo-full");
      } else {
        this.state.pluginsElement.addClass("oo-full");
        this.state.pluginsClickElement.addClass("oo-full");
      }
      this.renderSkin();
    },

    onShowAdMarquee: function(event, showAdMarquee) {
      this.state.showAdMarquee = showAdMarquee;
      this.renderSkin();
    },

    onSkipAdClicked: function(event) {
      this.state.isSkipAdClicked = true;
      OO.log("onSkipAdClicked is called");
      this.state.currentAdsInfo.skipAdButtonEnabled = false;
      this.mb.publish(OO.EVENTS.SKIP_AD);
      this.renderSkin();
    },

    onAdsClicked: function(source) {
      OO.log("on ads clicked is called", source);
      this.mb.publish(OO.EVENTS.ADS_CLICKED, {"source": source});
    },

    publishOverlayRenderingEvent: function(marginHeight) {
      this.mb.publish(OO.EVENTS.OVERLAY_RENDERING, {"marginHeight": marginHeight});
    },

    onPlayNonlinearAd: function(event, adInfo) {
      if(adInfo.url) {
        this.state.adOverlayUrl = adInfo.url;
        this.state.showAdOverlay = true;
      }
      this.state.pluginsElement.addClass("oo-overlay-showing");
      var skinElement = $("#"+this.state.elementId+" .oo-player-skin");
      var elementWidth = skinElement.width();
      var elementHeight = skinElement.height();
      var newCSS = {};
      if (adInfo.ad.height && adInfo.ad.height !== -1) {
        var padding = (adInfo.ad.paddingHeight ? adInfo.ad.paddingHeight : 0);
        newCSS.height = (adInfo.ad.height + padding) + "px";
        newCSS.top = "auto";
      } else {
        newCSS.top = 0;
        newCSS.bottom = 0;
      }
      if (adInfo.ad.width && adInfo.ad.width !== -1) {
        var padding = (adInfo.ad.paddingWidth ? adInfo.ad.paddingWidth : 0);
        newCSS.width = (adInfo.ad.width + padding) + "px";
        newCSS.left = "50%";
        newCSS.transform = "translateX(-50%)"
      }
      this.state.pluginsElement.css(newCSS);
      this.renderSkin();
    },

    onAdOverlayLoaded: function() {
      this.mb.publish(OO.EVENTS.NONLINEAR_AD_DISPLAYED);
    },

    onVideoElementFocus: function(event, source) {
      this.focusedElement = source;
      if (source == OO.VIDEO.MAIN) {
        this.state.pluginsElement.removeClass("oo-showing");
        this.state.pluginsClickElement.removeClass("oo-showing");
      }
    },

    closeNonlinearAd: function(event) {
      this.state.adOverlayUrl = null;
      this.state.showAdOverlay = false;
      this.state.showAdOverlayCloseButton = false;
      this.state.pluginsElement.removeClass("oo-overlay-showing");
      this.state.pluginsElement.css({
        top: "",
        left: "",
        right: "",
        bottom: "",
        height: "0",
        width: "0",
        transform: ""
      });
      this.renderSkin();
    },

    hideNonlinearAd: function(event) {
      this.state.showAdOverlay = false;
      this.state.pluginsElement.removeClass("oo-overlay-showing");
      this.renderSkin();
    },

    showNonlinearAd: function(event) {
      this.state.showAdOverlay = true;
      this.state.pluginsElement.addClass("oo-overlay-showing");
      this.renderSkin();
    },

    showNonlinearAdCloseButton: function(event) {
      this.state.showAdOverlayCloseButton = true;
      this.renderSkin();
    },

    onBitrateInfoAvailable: function(event, bitrates) {
      if (bitrates && bitrates.bitrates) {
        this.state.videoQualityOptions.availableBitrates = bitrates.bitrates;
        this.renderSkin({
          "videoQualityOptions": {
            "availableBitrates": bitrates.bitrates,
            "selectedBitrate": this.state.videoQualityOptions.selectedBitrate
          }
        });
      }
    },

    onClosedCaptionsInfoAvailable: function(event, languages) {
      this.state.closedCaptionOptions.availableLanguages = languages;
      if (this.state.closedCaptionOptions.enabled){
        this.setClosedCaptionsLanguage();
      }
    },

    onClosedCaptionCueChanged: function(event, data) {
      if (data && data.length > 0) {
        this.state.closedCaptionOptions.cueText = data;
      } else {
        this.state.closedCaptionOptions.cueText = null;
      }
      this.renderSkin();
    },

    onRelatedVideosFetched: function(event, relatedVideos) {
      OO.log("onRelatedVideosFetched is called");
      if (relatedVideos.videos) {
        this.state.discoveryData = {relatedVideos: relatedVideos.videos};
        this.state.upNextInfo.upNextData = relatedVideos.videos[0];
        this.renderSkin();
      }
    },

    // check if fullscreen is supported natively, set flag, add event listener for change
    enableFullScreen: function() {
      if (Fullscreen.enabled) {
        this.state.isFullScreenSupported = true;
        document.addEventListener(Fullscreen.raw.fullscreenchange, this.onFullscreenChanged.bind(this));
      }
    },

    // iOS webkitSupportsFullscreen property is not valid until metadata has loaded
    // https://developer.apple.com/library/safari/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/ControllingMediaWithJavaScript/ControllingMediaWithJavaScript.html#//apple_ref/doc/uid/TP40009523-CH3-SW13
    enableIosFullScreen: function() {
      if(!this.state.isFullScreenSupported) {
        if (this.state.mainVideoElement.get(0).webkitSupportsFullscreen) {
          this.state.isVideoFullScreenSupported = true;
          this.state.mainVideoElement.get(0).addEventListener("webkitbeginfullscreen", this.webkitBeginFullscreen.bind(this));
          this.state.mainVideoElement.get(0).addEventListener("webkitendfullscreen", this.webkitEndFullscreen.bind(this));
        }
      }
    },

    //called when event listener triggered
    onFullscreenChanged: function() {
      if (this.state.isFullScreenSupported) {
        this.state.fullscreen = Fullscreen.isFullscreen;
      } else {
        this.toggleFullscreen();
      }

      this.renderSkin();
    },

    //called when user selects fullscreen icon
    toggleFullscreen: function() {
      // full support, any element
      if(this.state.isFullScreenSupported) {
        Fullscreen.toggle(this.state.mainVideoInnerWrapper.get(0));
      }
      // partial support, video element only (iOS)
      else if (this.state.isVideoFullScreenSupported) {
        if(this.state.fullscreen) {
          this.state.mainVideoElement.get(0).webkitExitFullscreen();
        } else {
          this.state.mainVideoElement.get(0).webkitEnterFullscreen();
        }
      }
      // no support
      else {
        if(this.state.isFullWindow) {
          this.exitFullWindow();
        } else {
          this.enterFullWindow();
        }
      }
      this.state.fullscreen = !this.state.fullscreen;
      this.renderSkin();
    },

    // if fullscreen is not supported natively, "full window" style
    // is applied to video wrapper to fill browser window
    enterFullWindow: function() {
      this.state.isFullWindow = this.state.fullscreen = true;

      // add listener for esc key
      document.addEventListener("keydown", this.exitFullWindowOnEscKey.bind(this));
      // hide scroll bars
      document.documentElement.style.overflow = 'hidden';
      //apply full window style
      this.state.mainVideoInnerWrapper.addClass('oo-fullscreen');
    },

    // remove "full window" style and event listener
    exitFullWindow: function() {
      this.state.isFullWindow = this.state.fullscreen = false;

      // remove event listener
      document.removeEventListener("keydown", this.exitFullWindowOnEscKey);
      // unhide scroll bars
      document.documentElement.style.overflow = 'visible';
      //remove full window style
      this.state.mainVideoInnerWrapper.removeClass('oo-fullscreen');
    },

    // iOS event fires when a video enters full-screen mode
    webkitBeginFullscreen: function() {
      this.state.fullscreen = true;
    },

    // iOS event fires when a video exits full-screen mode
    webkitEndFullscreen: function() {
      this.state.fullscreen = false;
    },

    // exit full window on ESC key
    exitFullWindowOnEscKey: function(event) {
      if (event.keyCode === CONSTANTS.KEYCODES.ESCAPE_KEY) {
        event.preventDefault();
        this.exitFullWindow();
      }
    },

    onErrorEvent: function(event, errorCode){
      this.unsubscribeBasicPlaybackEvents();

      this.state.screenToShow = CONSTANTS.SCREEN.ERROR_SCREEN;
      this.state.playerState = CONSTANTS.STATE.ERROR;
      this.state.errorCode = errorCode;
      this.renderSkin();
    },

    unsubscribeFromMessageBus: function() {
      // basic playback events
      this.unsubscribeBasicPlaybackEvents();

      // player events
      this.mb.unsubscribe(OO.EVENTS.PLAYER_CREATED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.CONTENT_TREE_FETCHED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.AUTHORIZATION_FETCHED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.ASSET_CHANGED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.PLAYBACK_READY, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.ERROR, "customerUi");
    },

    unsubscribeBasicPlaybackEvents: function() {
      this.mb.unsubscribe(OO.EVENTS.INITIAL_PLAY, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.VC_PLAYED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.VC_PLAYING, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.VC_PAUSE, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.VC_PAUSED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.PLAYED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.PLAYHEAD_TIME_CHANGED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.SEEKED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.BUFFERING, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.BUFFERED, 'customerUi');
      this.mb.unsubscribe(OO.EVENTS.CLOSED_CAPTIONS_INFO_AVAILABLE, "customerUi");
      this.mb.unsubscribe(OO.EVENTS.BITRATE_INFO_AVAILABLE, "customerUi");
      this.mb.unsubscribe(OO.EVENTS.CLOSED_CAPTION_CUE_CHANGED, "customerUi");
      this.mb.unsubscribe(OO.EVENTS.VOLUME_CHANGED, "customerUi");
      this.mb.unsubscribe(OO.EVENTS.PLAYBACK_READY, 'customerUi');
      this.state.isPlaybackReadySubscribed = false;

      // ad events
      if (!Utils.isIPhone()) {
        //since iPhone is always playing in full screen and not showing our skin, don't need to render skin
        this.mb.unsubscribe(OO.EVENTS.ADS_PLAYED, "customerUi");
        this.mb.unsubscribe(OO.EVENTS.WILL_PLAY_ADS , "customerUi");
        this.mb.unsubscribe(OO.EVENTS.AD_POD_STARTED, "customerUi");
        this.mb.unsubscribe(OO.EVENTS.WILL_PLAY_SINGLE_AD , "customerUi");
        this.mb.unsubscribe(OO.EVENTS.SINGLE_AD_PLAYED , "customerUi");
        this.mb.unsubscribe(OO.EVENTS.PLAY_NONLINEAR_AD, "customerUi");
        this.mb.unsubscribe(OO.EVENTS.NONLINEAR_AD_PLAYED, "customerUi");
        this.mb.unsubscribe(OO.EVENTS.HIDE_NONLINEAR_AD, "customerUi");
        this.mb.unsubscribe(OO.EVENTS.SHOW_NONLINEAR_AD, "customerUi");
        this.mb.unsubscribe(OO.EVENTS.SHOW_AD_SKIP_BUTTON, "customerUi");
        this.mb.unsubscribe(OO.EVENTS.SHOW_AD_CONTROLS, "customerUi");
        this.mb.unsubscribe(OO.EVENTS.SHOW_AD_MARQUEE, "customerUi");

        if (OO.EVENTS.DISCOVERY_API) {
          this.mb.unsubscribe(OO.EVENTS.DISCOVERY_API.RELATED_VIDEOS_FETCHED, "customerUi");
        }
      }
      this.state.isSubscribed = false;
    },

    /*--------------------------------------------------------------------
     Skin state -> control skin
     ---------------------------------------------------------------------*/
    renderSkin: function(args) {
      if (this.state.configLoaded) {
        _.extend(this.state, args);
        this.skin.switchComponent(this.state);
      }
    },

    /*--------------------------------------------------------------------
     skin UI-action -> publish event to core player
     ---------------------------------------------------------------------*/
    toggleDiscoveryScreen: function() {
      switch(this.state.playerState) {
        case CONSTANTS.STATE.PLAYING:
          this.pausedCallback = function() {
            this.state.screenToShow = CONSTANTS.SCREEN.DISCOVERY_SCREEN;
            this.state.playerState = CONSTANTS.STATE.PAUSE;
            this.state.pluginsElement.addClass("oo-overlay-blur");
            this.renderSkin();
            OO.log("finished toggleDiscoveryScreen");
          }.bind(this);
          this.togglePlayPause();
          this.sendDiscoveryDisplayEvent("pauseScreen");
          break;
        case CONSTANTS.STATE.PAUSE:
          if(this.state.screenToShow === CONSTANTS.SCREEN.DISCOVERY_SCREEN) {
            this.state.pauseAnimationDisabled = true;
            this.state.pluginsElement.removeClass("oo-overlay-blur");
            this.state.screenToShow = CONSTANTS.SCREEN.PAUSE_SCREEN;
          }
          else {
            this.sendDiscoveryDisplayEvent("pauseScreen");
            this.state.pluginsElement.addClass("oo-overlay-blur");
            this.state.screenToShow = CONSTANTS.SCREEN.DISCOVERY_SCREEN;
          }
          break;
        case CONSTANTS.STATE.END:
          if(this.state.screenToShow === CONSTANTS.SCREEN.DISCOVERY_SCREEN) {
            this.state.pluginsElement.removeClass("oo-overlay-blur");
            this.state.screenToShow = CONSTANTS.SCREEN.END_SCREEN;
          }
          else {
            this.sendDiscoveryDisplayEvent("endScreen");
            this.state.pluginsElement.addClass("oo-overlay-blur");
            this.state.screenToShow = CONSTANTS.SCREEN.DISCOVERY_SCREEN;
          }
          break;
      }
      this.renderSkin();
    },

    toggleMute: function(muted) {
      this.mb.publish(OO.EVENTS.CHANGE_VOLUME, (muted ? 0 : 1));
    },

    togglePlayPause: function() {
      switch (this.state.playerState) {
        case CONSTANTS.STATE.START:
          this.mb.publish(OO.EVENTS.INITIAL_PLAY);
          break;
        case CONSTANTS.STATE.END:
          if(Utils.isAndroid() || Utils.isIos()) {
            if(this.state.isSkipAdClicked) {
             this.state.isSkipAdClicked = false;
            }
            else
            {
               this.mb.publish(OO.EVENTS.REPLAY);
            }
          } else {
            this.mb.publish(OO.EVENTS.REPLAY);
          }
          break;
        case CONSTANTS.STATE.PAUSE:
          this.mb.publish(OO.EVENTS.PLAY);
          break;
        case CONSTANTS.STATE.PLAYING:
          this.mb.publish(OO.EVENTS.PAUSE);
          break;
      }
    },

    seek: function(seconds) {
      if (this.state.playerState == CONSTANTS.STATE.END) {
        this.endSeeking();
        this.mb.publish(OO.EVENTS.REPLAY, seconds);
      }
      else {
        this.mb.publish(OO.EVENTS.SEEK, seconds);
      }
    },

    onLiveClick: function() {
      this.mb.publish(OO.EVENTS.LIVE_BUTTON_CLICKED);
    },

    setVolume: function(volume){
      if(volume == 0) {
        this.state.volumeState.muted = true;
      }
      else {
        this.state.volumeState.muted = false;
      }
      this.state.volumeState.volume = volume;
      this.mb.publish(OO.EVENTS.CHANGE_VOLUME, volume);
      this.renderSkin();
    },

    handleMuteClick: function() {
      var newVolumeSettings = {};
      if (!this.state.volumeState.muted) {
        //if we're muting, save the current volume so we can
        //restore it when we un-mute
        newVolumeSettings = {
          oldVolume: this.state.volumeState.volume,
          muted: !this.state.volumeState.muted
        };
        this.setVolume(0);
      }
      else {
        //restore the volume to the previous setting
        newVolumeSettings = {
          oldVolume: 0,
          muted: !this.state.volumeState.muted
        };
        this.setVolume(this.state.volumeState.oldVolume);
      }

      this.state.volumeState.oldVolume = newVolumeSettings.oldVolume;
      this.state.volumeState.muted = newVolumeSettings.muted;
    },

    toggleShareScreen: function() {
      if (this.state.screenToShow == CONSTANTS.SCREEN.SHARE_SCREEN) {
        this.closeScreen();
      }
      else {
        if (this.state.playerState == CONSTANTS.STATE.PLAYING || this.state.playerState == CONSTANTS.STATE.START) {
          this.pausedCallback = function() {
            this.state.pluginsElement.addClass("oo-overlay-blur");
            this.state.screenToShow = CONSTANTS.SCREEN.SHARE_SCREEN;
            this.renderSkin();
          }.bind(this);
          this.mb.publish(OO.EVENTS.PAUSE);
        }
        else {
          this.state.screenToShow = CONSTANTS.SCREEN.SHARE_SCREEN;
          this.state.pluginsElement.addClass("oo-overlay-blur");
          this.renderSkin();
        }
      }
    },

    toggleScreen: function(screen) {
      if (this.state.screenToShow == screen) {
        this.closeScreen();
      }
      else {
        if (this.state.playerState == CONSTANTS.STATE.PLAYING) {
          this.pausedCallback = function() {
            this.state.pluginsElement.addClass("oo-overlay-blur");
            this.state.screenToShow = screen;
            this.renderSkin();
          }.bind(this);
          this.mb.publish(OO.EVENTS.PAUSE);
        }
        else {
          this.state.screenToShow = screen;
          this.state.pluginsElement.addClass("oo-overlay-blur");
          this.renderSkin();
        }
      }
    },

    sendDiscoveryClickEvent: function(selectedContentData, isAutoUpNext) {
      this.state.upNextInfo.showing = false;
      if (isAutoUpNext){
        this.state.upNextInfo.delayedContentData = selectedContentData;
        this.state.upNextInfo.delayedSetEmbedCodeEvent = true;
      }
      else {
        this.state.screenToShow = CONSTANTS.SCREEN.LOADING_SCREEN;
        this.renderSkin();
        this.mb.publish(OO.EVENTS.PAUSE);
        if (selectedContentData.clickedVideo.embed_code){
          this.mb.publish(OO.EVENTS.SET_EMBED_CODE, selectedContentData.clickedVideo.embed_code);
        }
        else if (selectedContentData.clickedVideo.asset){
          this.mb.publish(OO.EVENTS.SET_ASSET, selectedContentData.clickedVideo.asset);
        }
        this.mb.publish(OO.EVENTS.DISCOVERY_API.SEND_CLICK_EVENT, selectedContentData);
      }
    },

    sendDiscoveryDisplayEvent: function(screen) {
      var eventData = {
        "relatedVideos" : this.state.discoveryData.relatedVideos,
        "custom" : { "source" : screen}
      };
      this.mb.publish(OO.EVENTS.DISCOVERY_API.SEND_DISPLAY_EVENT, eventData);
    },

    toggleVideoQualityPopOver: function() {
      this.state.videoQualityOptions.showVideoQualityPopover = !this.state.videoQualityOptions.showVideoQualityPopover;
      this.renderSkin();
    },

    toggleClosedCaptionPopOver: function() {
      this.state.closedCaptionOptions.showClosedCaptionPopover = !this.state.closedCaptionOptions.showClosedCaptionPopover;
      this.renderSkin();
    },

    receiveVideoQualityChangeEvent: function(eventName, targetBitrate) {
        this.state.videoQualityOptions.selectedBitrate = {
        "id": targetBitrate
      };
      this.renderSkin({
          "videoQualityOptions": {
            "availableBitrates": this.state.videoQualityOptions.availableBitrates,
            "selectedBitrate": this.state.videoQualityOptions.selectedBitrate,
            "showVideoQualityPopover":this.state.videoQualityOptions.showVideoQualityPopover
          }
        });
      if(this.state.videoQualityOptions.showVideoQualityPopover == true) {
        this.toggleVideoQualityPopOver();
      }
    },

    sendVideoQualityChangeEvent: function(selectedContentData) {
      this.state.videoQualityOptions.selectedBitrate = {
        "id": selectedContentData.id
      };
      this.mb.publish(OO.EVENTS.SET_TARGET_BITRATE, selectedContentData.id);
    },

    setClosedCaptionsLanguage: function(){
      var availableLanguages = this.state.closedCaptionOptions.availableLanguages;
      //if saved language not in available languages, set to first available language
      if (availableLanguages && (this.state.closedCaptionOptions.language == null || !_.contains(availableLanguages.languages, this.state.closedCaptionOptions.language))) {
        this.state.closedCaptionOptions.language = availableLanguages.languages[0];
      }
      var language = this.state.closedCaptionOptions.enabled ? this.state.closedCaptionOptions.language : "";
      var mode = this.state.closedCaptionOptions.enabled ? OO.CONSTANTS.CLOSED_CAPTIONS.HIDDEN : OO.CONSTANTS.CLOSED_CAPTIONS.DISABLED;
      this.mb.publish(OO.EVENTS.SET_CLOSED_CAPTIONS_LANGUAGE, language, {"mode": mode});
    },

    closeScreen: function() {
      this.state.pluginsElement.removeClass("oo-overlay-blur");
      this.state.pauseAnimationDisabled = true;
      if (this.state.playerState == CONSTANTS.STATE.PAUSE) {
        this.state.screenToShow = CONSTANTS.SCREEN.PAUSE_SCREEN;
      }
      else if (this.state.playerState == CONSTANTS.STATE.END) {
        this.state.screenToShow = CONSTANTS.SCREEN.END_SCREEN;
      }
      this.renderSkin();
    },

    onClosedCaptionChange: function(name, value) {
      this.state.closedCaptionOptions[name] = this.state.persistentSettings.closedCaptionOptions[name] = value;
      if (name === 'language') {
        this.setClosedCaptionsLanguage();
      }
      this.renderSkin();
      this.mb.publish(OO.EVENTS.SAVE_PLAYER_SETTINGS, this.state.persistentSettings);
    },

    toggleClosedCaptionEnabled: function() {
      this.state.closedCaptionOptions.enabled = !this.state.closedCaptionOptions.enabled;
      this.state.persistentSettings.closedCaptionOptions['enabled'] = !!this.state.closedCaptionOptions.enabled;
      this.setClosedCaptionsLanguage();
      this.renderSkin();
      this.mb.publish(OO.EVENTS.SAVE_PLAYER_SETTINGS, this.state.persistentSettings);
    },

    upNextDismissButtonClicked: function() {
      this.state.upNextInfo.countDownCancelled = true;
      this.state.upNextInfo.showing = false;
      this.renderSkin();
    },

    toggleMoreOptionsScreen: function(moreOptionsItems) {
      if (this.state.screenToShow == CONSTANTS.SCREEN.MORE_OPTIONS_SCREEN) {
        this.closeMoreOptionsScreen();
      } else {
        this.displayMoreOptionsScreen(moreOptionsItems);
      }
    },

    closeMoreOptionsScreen: function() {
      this.state.pauseAnimationDisabled = true;
      this.state.screenToShow = CONSTANTS.SCREEN.PAUSE_SCREEN;
      this.state.playerState = CONSTANTS.STATE.PAUSE;
      this.state.moreOptionsItems = null;
      this.state.pluginsElement.removeClass("oo-overlay-blur");
      this.renderSkin();
    },

    displayMoreOptionsScreen: function(moreOptionsItems) {
      if (this.state.playerState == CONSTANTS.STATE.PLAYING) {
        this.pausedCallback = function() {
          this.state.screenToShow = CONSTANTS.SCREEN.MORE_OPTIONS_SCREEN;
          this.state.pluginsElement.addClass("oo-overlay-blur");
          this.renderSkin();
        }.bind(this);
        this.mb.publish(OO.EVENTS.PAUSE);
      }
      else {
        this.state.screenToShow = CONSTANTS.SCREEN.MORE_OPTIONS_SCREEN;
        this.state.pluginsElement.addClass("oo-overlay-blur");
        this.renderSkin();
      }
      this.state.moreOptionsItems = moreOptionsItems;
    },

    enablePauseAnimation: function(){
      this.state.pauseAnimationDisabled = false;
    },

    beginSeeking: function() {
      this.state.seeking = true;
    },

    endSeeking: function() {
      this.state.seeking = false;
    },

    updateSeekingPlayhead: function(playhead) {
      playhead = Math.min(Math.max(0, playhead), this.skin.state.duration);
      this.skin.updatePlayhead(playhead, this.skin.state.duration, this.skin.state.buffered);
    },

    hideVolumeSliderBar: function() {
      this.state.volumeState.volumeSliderVisible = false;
      this.renderSkin();
    },

    showVolumeSliderBar: function() {
      this.state.volumeState.volumeSliderVisible = true;
      this.renderSkin();
    },

    startHideControlBarTimer: function() {
      if (this.skin.props.skinConfig.controlBar.autoHide == true) {
        this.cancelTimer();
        var timer = setTimeout(function() {
          if(this.state.controlBarVisible === true){
            this.hideControlBar();
          }
        }.bind(this), 3000);
        this.state.timer = timer;
      }
    },

    showControlBar: function() {
      this.state.controlBarVisible = true;
    },

    hideControlBar: function() {
      this.state.controlBarVisible = false;
      if (Utils.isAndroid()) {
        this.hideVolumeSliderBar();
      }
    },

    cancelTimer: function() {
      if (this.state.timer !== null){
        clearTimeout(this.state.timer);
        this.state.timer = null;
      }
    },

    //use fixed aspect ratio number from skinConfig
    updateAspectRatio: function() {
      if(this.skin && this.skin.props.skinConfig.responsive.aspectRatio && this.skin.props.skinConfig.responsive.aspectRatio != "auto") {
        this.state.mainVideoAspectRatio = this.skin.props.skinConfig.responsive.aspectRatio;
        this.setAspectRatio();
      }
    },

    //returns original video aspect ratio
    calculateAspectRatio: function(width, height) {
      var aspectRatio = ((height / width) * 100).toFixed(2);
      return aspectRatio;
    },

    //set Main Video Element Wrapper padding-top to aspect ratio
    setAspectRatio: function() {
      if(this.state.mainVideoAspectRatio > 0) {
        this.state.mainVideoInnerWrapper.css("padding-top", this.state.mainVideoAspectRatio+"%");
      }
    }
  };

  return Html5Skin;
});

},{"./components/accessibilityControls":1,"./components/utils":34,"./constants/constants":36,"./skin":42,"react":212,"react-dom":55,"screenfull":213}],38:[function(require,module,exports){
/**
 * Enables accessability controls.
 *
 * @mixin AccessibilityMixin
 * @requires this.props.controller.state.accessibilityControlsEnabled
 */
var AccessibilityMixin = {
  componentDidMount: function() {
    this.props.controller.state.accessibilityControlsEnabled = false;
  },

  componentWillUnmount: function() {
    this.props.controller.state.accessibilityControlsEnabled = true;
  }
};
module.exports = AccessibilityMixin;

},{}],39:[function(require,module,exports){
/**
 * Enable animation after component mounts
 * Set animate state var 1ms after component mounts
 * animate state var used to add css class to element
 *
 * @mixin AnimateMixin
 * @fires startAnimation()
 * @this component using AnimateMixin
 */

var AnimateMixin = {
  getInitialState: function() {
    return {
      animate: false
    };
  },

  componentDidMount: function () {
    setTimeout(this.startAnimation, 1);
  },

  startAnimation: function () {
    this.setState({
      animate: true
    });
  }
};
module.exports = AnimateMixin;

},{}],40:[function(require,module,exports){
/**
 * Fires handleResize() function if player width (props.componentWidth) changes
 *
 * @mixin ResizeMixin
 * @fires handleResize()
 * @param props.componentWidth
 * @this component using ResizeMixin
 */

var ResizeMixin = {
  componentWillReceiveProps: function(nextProps) {
    if (nextProps.componentWidth != this.props.componentWidth) {
      this.handleResize(nextProps);
    }
  }
};
module.exports = ResizeMixin;

},{}],41:[function(require,module,exports){
var ReactDOM = require('react-dom'),
    ClassNames = require('classnames'),
    debounce = require('lodash.debounce');

var ResponsiveManagerMixin = {
  getInitialState: function() {
      return {
        componentWidth: null,
        responsiveClass: null,
        responsiveId: null
      };
  },

  componentDidMount: function() {
    window.addEventListener('resize', debounce(this.onResize, 150));
    window.addEventListener('webkitfullscreenchange', debounce(this.onResize, 150));
    this.generateResponsiveData();
  },

  componentWillUnmount: function() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('webkitfullscreenchange', this.onResize);
  },

  onResize: function() {
    this.generateResponsiveData();
  },

  generateResponsiveData: function() {
    var componentWidth = ReactDOM.findDOMNode(this).getBoundingClientRect().width;
    var breakpoints = this.props.skinConfig.responsive.breakpoints;
    var breakpointData = {
      classes: {},
      ids: {}
    };

    //loop through breakpoints from skinConfig
    //generate Classname object with name and min/max width
    for (var key in breakpoints) {
      if (breakpoints.hasOwnProperty(key)) {
        //min width only, 1st breakpoint
        if(breakpoints[key].minWidth && !breakpoints[key].maxWidth) {
          breakpointData.classes[breakpoints[key].name] = breakpointData.ids[breakpoints[key].id] = componentWidth >= breakpoints[key].minWidth;
        }
        //min and max, middle breakpoints
        else if(breakpoints[key].minWidth && breakpoints[key].maxWidth) {
          breakpointData.classes[breakpoints[key].name] = breakpointData.ids[breakpoints[key].id] = componentWidth >= breakpoints[key].minWidth && componentWidth <= breakpoints[key].maxWidth;
        }
        //max width only, last breakpoint
        else if(breakpoints[key].maxWidth && !breakpoints[key].minWidth) {
          breakpointData.classes[breakpoints[key].name] = breakpointData.ids[breakpoints[key].id] = componentWidth <= breakpoints[key].maxWidth;
        }
      }
    }

    //set responsive data to state
    this.setState({
      componentWidth: componentWidth,
      responsiveClass: ClassNames(breakpointData.classes),
      responsiveId: ClassNames(breakpointData.ids)
    });
  }
};
module.exports = ResponsiveManagerMixin;

},{"classnames":51,"lodash.debounce":52,"react-dom":55}],42:[function(require,module,exports){
/********************************************************************
  RENDERER PLACEHOLDER
*********************************************************************/
var React = require('react'),
    Utils = require('./components/utils'),
    CONSTANTS = require('./constants/constants'),
    Spinner = require('./components/spinner'),
    OnOffSwitch = require('./components/closed-caption/onOffSwitch'),
    ClosedCaptionPanel = require('./components/closed-caption/closedCaptionPanel'),
    DiscoveryPanel = require('./components/discoveryPanel'),
    VideoQualityPanel = require('./components/videoQualityPanel'),
    SharePanel = require('./components/sharePanel'),
    MoreOptionsPanel = require('./components/moreOptionsPanel'),
    AdScreen = require('./views/adScreen'),
    EndScreen = require('./views/endScreen'),
    StartScreen = require('./views/startScreen'),
    PauseScreen = require('./views/pauseScreen'),
    PlayingScreen = require('./views/playingScreen'),
    ErrorScreen = require('./views/errorScreen'),
    ContentScreen = require('./views/contentScreen'),
    ResponsiveManagerMixin = require('./mixins/responsiveManagerMixin');

var Skin = React.createClass({displayName: "Skin",
  mixins: [ResponsiveManagerMixin],

  getInitialState: function() {
    this.overlayRenderingEventSent = false;
    return {
      screenToShow: null,
      currentPlayhead: 0,
      discoveryData: null
    };
  },

  componentDidUpdate: function() {
    // Notify AMC the correct overlay rendering info
    if (this.state.screenToShow !== null && !this.overlayRenderingEventSent) {
      var responsiveUIMultiple = this.props.skinConfig.responsive.breakpoints[this.state.responsiveId].multiplier;
      var marginHeight = responsiveUIMultiple * this.props.skinConfig.controlBar.height;
      this.props.controller.publishOverlayRenderingEvent(marginHeight);
      this.overlayRenderingEventSent = true;
    }
  },

  componentDidMount: function () {
    window.addEventListener('mouseup', this.handleClickOutsidePlayer);
  },

  componentWillUnmount: function () {
    window.removeEventListener('mouseup', this.handleClickOutsidePlayer);
  },

  handleClickOutsidePlayer: function() {
    this.props.controller.state.accessibilityControlsEnabled = false;
  },

  switchComponent: function(args) {
    var newState = args || {};
    this.setState(newState);
  },

  updatePlayhead: function(newPlayhead, newDuration, newBuffered) {
    this.setState({
      currentPlayhead: newPlayhead,
      duration: newDuration,
      buffered: newBuffered
    });
  },

  render: function() {
    var screen;

    //For IE10, use the start screen and that's it.
    if (Utils.isIE10()){
      if (this.state.screenToShow == CONSTANTS.SCREEN.START_SCREEN){
        screen = (
          React.createElement(StartScreen, React.__spread({},  this.props, 
            {componentWidth: this.state.componentWidth, 
            contentTree: this.state.contentTree}))
        );
      }
      else {
        screen = (React.createElement("div", null));
      }
    }
    //switch screenToShow
    else {
      switch (this.state.screenToShow) {
        case CONSTANTS.SCREEN.LOADING_SCREEN:
          screen = (
            React.createElement(Spinner, {loadingImage: this.props.skinConfig.general.loadingImage.imageResource.url})
          );
          break;
        case CONSTANTS.SCREEN.START_SCREEN:
          screen = (
            React.createElement(StartScreen, React.__spread({},  this.props, 
              {componentWidth: this.state.componentWidth, 
              contentTree: this.state.contentTree}))
          );
          break;
        case CONSTANTS.SCREEN.PLAYING_SCREEN:
          screen = (
            React.createElement(PlayingScreen, React.__spread({},  this.props, 
              {contentTree: this.state.contentTree, 
              currentPlayhead: this.state.currentPlayhead, 
              duration: this.state.duration, 
              buffered: this.state.buffered, 
              fullscreen: this.state.fullscreen, 
              playerState: this.state.playerState, 
              seeking: this.state.seeking, 
              upNextInfo: this.state.upNextInfo, 
              isLiveStream: this.state.isLiveStream, 
              controlBarAutoHide: this.props.skinConfig.controlBar.autoHide, 
              responsiveView: this.state.responsiveId, 
              componentWidth: this.state.componentWidth, 
              videoQualityOptions: this.state.videoQualityOptions, 
              closedCaptionOptions: this.props.closedCaptionOptions, 
              ref: "playScreen"}))
          );
          break;
        case CONSTANTS.SCREEN.SHARE_SCREEN:
          screen = (
          React.createElement(ContentScreen, React.__spread({}, 
            this.props, 
            {screen: CONSTANTS.SCREEN.SHARE_SCREEN, 
            icon: "share"}), 
            React.createElement(SharePanel, React.__spread({}, 
              this.props, 
              {assetId: this.state.assetId, 
              playerParam: this.state.playerParam, 
              contentTree: this.state.contentTree}))
          )
          );
          break;
        case CONSTANTS.SCREEN.PAUSE_SCREEN:
          screen = (
            React.createElement(PauseScreen, React.__spread({},  this.props, 
              {contentTree: this.state.contentTree, 
              currentPlayhead: this.state.currentPlayhead, 
              playerState: this.state.playerState, 
              duration: this.state.duration, 
              buffered: this.state.buffered, 
              pauseAnimationDisabled: this.state.pauseAnimationDisabled, 
              fullscreen: this.state.fullscreen, 
              seeking: this.state.seeking, 
              upNextInfo: this.state.upNextInfo, 
              isLiveStream: this.state.isLiveStream, 
              responsiveView: this.state.responsiveId, 
              componentWidth: this.state.componentWidth, 
              videoQualityOptions: this.state.videoQualityOptions, 
              ref: "pauseScreen"}))
          );
          break;
        case CONSTANTS.SCREEN.END_SCREEN:
          screen = (
            React.createElement(EndScreen, React.__spread({},  this.props, 
              {contentTree: this.state.contentTree, 
              discoveryData: this.state.discoveryData, 
              currentPlayhead: this.state.currentPlayhead, 
              duration: this.state.duration, 
              buffered: this.state.buffered, 
              fullscreen: this.state.fullscreen, 
              playerState: this.state.playerState, 
              seeking: this.state.seeking, 
              isLiveStream: this.state.isLiveStream, 
              responsiveView: this.state.responsiveId, 
              videoQualityOptions: this.state.videoQualityOptions, 
              componentWidth: this.state.componentWidth, 
              ref: "endScreen"}))
          );
          break;
        case CONSTANTS.SCREEN.AD_SCREEN:
          screen = (
            React.createElement(AdScreen, React.__spread({},  this.props, 
              {contentTree: this.state.contentTree, 
              currentAdsInfo: this.state.currentAdsInfo, 
              currentPlayhead: this.state.currentPlayhead, 
              fullscreen: this.state.fullscreen, 
              playerState: this.state.playerState, 
              duration: this.state.duration, 
              adVideoDuration: this.props.controller.state.adVideoDuration, 
              buffered: this.state.buffered, 
              seeking: this.state.seeking, 
              controlBarAutoHide: this.props.skinConfig.controlBar.autoHide, 
              responsiveView: this.state.responsiveId, 
              componentWidth: this.state.componentWidth, 
              videoQualityOptions: this.state.videoQualityOptions, 
              adStartTime: this.state.adStartTime, 
              ref: "adScreen"}))
          );
          break;
        case CONSTANTS.SCREEN.DISCOVERY_SCREEN:
          screen = (
            React.createElement(ContentScreen, React.__spread({}, 
              this.props, 
              {screen: CONSTANTS.SCREEN.DISCOVERY_SCREEN, 
              titleText: CONSTANTS.SKIN_TEXT.DISCOVER, 
              icon: "discovery"}), 
              React.createElement(DiscoveryPanel, React.__spread({}, 
                this.props, 
                {videosPerPage: {xs:2, sm:4, md:6, lg:8}, 
                discoveryData: this.state.discoveryData, 
                playerState: this.state.playerState, 
                responsiveView: this.state.responsiveId, 
                componentWidth: this.state.componentWidth}))
            )
          );
          break;
        case CONSTANTS.SCREEN.MORE_OPTIONS_SCREEN:
          screen = (
          React.createElement(ContentScreen, React.__spread({}, 
            this.props, 
            {screen: CONSTANTS.SCREEN.MORE_OPTIONS_SCREEN}), 
            React.createElement(MoreOptionsPanel, React.__spread({}, 
              this.props, 
              {fullscreen: this.state.fullscreen}))
          )
          );
          break;
        case CONSTANTS.SCREEN.CLOSEDCAPTION_SCREEN:
          screen = (
          React.createElement(ContentScreen, React.__spread({}, 
            this.props, 
            {screen: CONSTANTS.SCREEN.CLOSEDCAPTION_SCREEN, 
            screenClassName: "oo-content-screen oo-content-screen-closed-captions", 
            titleText: CONSTANTS.SKIN_TEXT.CC_OPTIONS, 
            closedCaptionOptions: this.props.closedCaptionOptions, 
            element: React.createElement(OnOffSwitch, React.__spread({},  this.props)), 
            icon: "cc"}), 
            React.createElement(ClosedCaptionPanel, React.__spread({}, 
              this.props, 
              {closedCaptionOptions: this.props.closedCaptionOptions, 
              dataItemsPerPage: {xs:1, sm:4, md:8, lg:8}, 
              responsiveView: this.state.responsiveId, 
              componentWidth: this.state.componentWidth}))
          )
          );
          break;
        case CONSTANTS.SCREEN.VIDEO_QUALITY_SCREEN:
          screen = (
          React.createElement(ContentScreen, React.__spread({}, 
            this.props, 
            {screen: CONSTANTS.SCREEN.VIDEO_QUALITY_SCREEN, 
            titleText: CONSTANTS.SKIN_TEXT.VIDEO_QUALITY, 
            icon: "quality"}), 
            React.createElement(VideoQualityPanel, React.__spread({}, 
              this.props, 
              {fullscreen: this.state.fullscreen, 
              videoQualityOptions: this.state.videoQualityOptions, 
              responsiveView: this.state.responsiveId}))
          )
          );
          break;
        case CONSTANTS.SCREEN.ERROR_SCREEN:
          screen = (
            React.createElement(ErrorScreen, React.__spread({},  this.props, 
              {errorCode: this.props.controller.state.errorCode}))
          );
          break;
        default:
          screen = (React.createElement("div", null));
      }
    }

    return (
      React.createElement("div", {id: "oo-responsive", className: this.state.responsiveClass}, 
        screen
      )
    );
  }
});
module.exports = Skin;

},{"./components/closed-caption/closedCaptionPanel":7,"./components/closed-caption/onOffSwitch":13,"./components/discoveryPanel":21,"./components/moreOptionsPanel":24,"./components/sharePanel":26,"./components/spinner":28,"./components/utils":34,"./components/videoQualityPanel":35,"./constants/constants":36,"./mixins/responsiveManagerMixin":41,"./views/adScreen":43,"./views/contentScreen":44,"./views/endScreen":45,"./views/errorScreen":46,"./views/pauseScreen":47,"./views/playingScreen":48,"./views/startScreen":50,"react":212}],43:[function(require,module,exports){
/********************************************************************
  AD SCREEN
*********************************************************************/
var React = require('react'),
    CONSTANTS = require('../constants/constants'),
    AdPanel = require('../components/adPanel'),
    ControlBar = require('../components/controlBar'),
    ClassNames = require('classnames'),
    Utils = require('../components/utils'),
    ResizeMixin = require('../mixins/resizeMixin'),
    Icon = require('../components/icon');

var AdScreen = React.createClass({displayName: "AdScreen",
  mixins: [ResizeMixin],

  getInitialState: function() {
    this.isMobile = this.props.controller.state.isMobile;
    return {
      controlBarVisible: true,
      timer: null
    };
  },

  componentDidMount: function () {
    //for mobile or desktop fullscreen, hide control bar after 3 seconds
    if (this.isMobile || this.props.fullscreen) {
      this.props.controller.startHideControlBarTimer();
    }
  },

  componentWillUpdate: function(nextProps) {
    if(nextProps) {
      if (nextProps.controller.state.controlBarVisible == false && this.state.controlBarVisible == true) {
        this.hideControlBar();
      }

      if (nextProps.controller.state.controlBarVisible == true && this.state.controlBarVisible == false) {
        this.showControlBar();
      }

      if(!this.props.fullscreen && nextProps.fullscreen && this.state.playerState != CONSTANTS.STATE.PAUSE) {
        this.props.controller.startHideControlBarTimer();
      }
      if(this.props.fullscreen && !nextProps.fullscreen && this.isMobile) {
        this.showControlBar();
        this.props.controller.startHideControlBarTimer();
      }
    }
  },

  componentWillUnmount: function () {
    this.props.controller.cancelTimer();
  },

  handleResize: function() {
    if (this.isMounted()) {
      this.props.controller.startHideControlBarTimer();
    }
  },

  handleClick: function(event) {
    event.stopPropagation(); // W3C
    event.cancelBubble = true; // IE

    this.props.controller.state.accessibilityControlsEnabled = true;
    if ((event.type == 'click' || !this.isMobile) && !this.props.skinConfig.adScreen.showAdMarquee) {
      this.props.controller.onAdsClicked(CONSTANTS.AD_CLICK_SOURCE.VIDEO_WINDOW);
    }
  },

  handlePlayerClicked: function(event) {
    if (event.type == 'touchend' || !this.isMobile) {
      //since mobile would fire both click and touched events,
      //we need to make sure only one actually does the work

      //since after exiting the full screen, iPhone pauses the video and places an overlay play button in the middle
      //of the screen (which we can't remove), clicking the screen would start the video.
      if (Utils.isIPhone() && this.state.playerState == CONSTANTS.STATE.PAUSE) {
        this.props.controller.togglePlayPause();
      }
      else {
        event.stopPropagation(); // W3C
        event.cancelBubble = true; // IE
        this.props.controller.onAdsClicked(CONSTANTS.AD_CLICK_SOURCE.VIDEO_WINDOW);
      }
    }
  },

  showControlBar: function() {
    this.setState({controlBarVisible: true});
    this.props.controller.showControlBar();
  },

  hideControlBar: function(event) {
    if (this.props.controlBarAutoHide == true && !(this.isMobile && event)) {
      this.setState({controlBarVisible: false});
      this.props.controller.hideControlBar();
    }
  },

  handleTouchEnd: function(event) {
    // handleTouchEnd is used to verify controlBar visibility.
    if (!this.state.controlBarVisible && this.props.skinConfig.adScreen.showControlBar) {
      this.showControlBar();
      // Do not start the process to hide the control bar unless we are leaving pause state.
      if (this.props.playerState == CONSTANTS.STATE.PAUSE) {
        this.props.controller.startHideControlBarTimer();
      }
    }
    // Even if our action was to start showing the control bar, we should still handle
    // the click to prevent the need to double tap.
    this.handlePlayerClicked(event);
  },

  handlePlayerMouseMove: function() {
    if(this.props.playerState !== CONSTANTS.STATE.PAUSE && !this.isMobile && this.props.fullscreen) {
      this.showControlBar();
      this.props.controller.startHideControlBarTimer();
    }
  },

  getPlaybackControlItems: function() {
    if (!this.props.controller.state.showAdControls) return null;

    var showControlBar =
      this.props.playerState == CONSTANTS.STATE.PAUSE ||
      this.props.controller.state.forceControlBarVisible ||
      this.state.controlBarVisible;

    var playbackControlItemTemplates = {
     "controlBar": React.createElement(ControlBar, React.__spread({},  this.props, 
       {controlBarVisible: showControlBar, 
       playerState: this.props.playerState, 
       key: "controlBar"}))
    };

    var playbackControlItems = [];
    for(var item in playbackControlItemTemplates) {
      playbackControlItems.push(playbackControlItemTemplates[item]);
    }

    return playbackControlItems;
  },

  render: function() {
    var actionIconStyle = {
      color: this.props.skinConfig.pauseScreen.PauseIconStyle.color,
      opacity: this.props.skinConfig.pauseScreen.PauseIconStyle.opacity
    };
    var actionIconClass = ClassNames({
      'oo-action-icon-pause': !this.props.controller.state.adPauseAnimationDisabled,
      'oo-action-icon': this.props.controller.state.adPauseAnimationDisabled,
      'oo-animate-pause': !this.props.controller.state.adPauseAnimationDisabled,
      'oo-action-icon-top': this.props.skinConfig.pauseScreen.pauseIconPosition.toLowerCase().indexOf("top") > -1,
      'oo-action-icon-bottom': this.props.skinConfig.pauseScreen.pauseIconPosition.toLowerCase().indexOf("bottom") > -1,
      'oo-action-icon-left': this.props.skinConfig.pauseScreen.pauseIconPosition.toLowerCase().indexOf("left") > -1,
      'oo-action-icon-right': this.props.skinConfig.pauseScreen.pauseIconPosition.toLowerCase().indexOf("right") > -1,
      'oo-hidden': !this.props.skinConfig.pauseScreen.showPauseIcon,
      'oo-icon-hidden': this.props.playerState != CONSTANTS.STATE.PAUSE
    });
    var adPanel = null;
    if (this.props.skinConfig.adScreen.showAdMarquee && this.props.controller.state.showAdMarquee) {
      adPanel = React.createElement(AdPanel, React.__spread({},  this.props));
    }
    var playbackControlItems = null;
    if(this.props.skinConfig.adScreen.showControlBar) {
      playbackControlItems = this.getPlaybackControlItems();
    }

    return (
      React.createElement("div", {className: "oo-state-screen oo-ad-screen", 
         ref: "adScreen", 
         onMouseOver: this.showControlBar, 
         onMouseOut: this.hideControlBar, 
         onMouseMove: this.handlePlayerMouseMove, 
         onMouseUp: this.handleClick}, 

        React.createElement("a", {className: actionIconClass}, 
          React.createElement(Icon, React.__spread({},  this.props, {icon: "pause", style: actionIconStyle}))
        ), 
        React.createElement("div", {className: "oo-ad-panel", ref: "adPanel", onClick: this.handlePlayerClicked, onTouchEnd: this.handleTouchEnd}, 
          adPanel
        ), 
        React.createElement("div", {className: "oo-interactive-container"}, 
          playbackControlItems
        )

      )
    );
  }
});
module.exports = AdScreen;

},{"../components/adPanel":3,"../components/controlBar":17,"../components/icon":22,"../components/utils":34,"../constants/constants":36,"../mixins/resizeMixin":40,"classnames":51,"react":212}],44:[function(require,module,exports){
var React = require('react'),
    CloseButton = require('../components/closeButton'),
    Utils = require('../components/utils'),
    CONSTANTS = require('../constants/constants'),
    Icon = require('../components/icon'),
    AccessibilityMixin = require('../mixins/accessibilityMixin');

var ContentScreen = React.createClass({displayName: "ContentScreen",
  mixins: [AccessibilityMixin],

  handleClose: function() {
    switch(this.props.screen) {
      case CONSTANTS.SCREEN.DISCOVERY_SCREEN:
        this.props.controller.toggleDiscoveryScreen();
        break;
      default:
        this.props.controller.toggleScreen(this.props.screen);
    }
  },

  render: function() {
    //overlay only for the closed captions screen. Needs to be different than the other screens because of closed caption preview.
    var closedCaptionOverlay = this.props.screen == CONSTANTS.SCREEN.CLOSEDCAPTION_SCREEN ? (
      React.createElement("div", {className: "oo-closed-caption-overlay"})
    ) :
    null;

    //localized title bar, show nothing if no title text
    var titleBar = this.props.titleText ? (
      React.createElement("div", {className: "oo-content-screen-title"}, 
        Utils.getLocalizedString(this.props.language, this.props.titleText, this.props.localizableStrings), 
        React.createElement(Icon, React.__spread({},  this.props, {icon: this.props.icon})), 
        this.props.element
      )
    ) :
    null;

    return (
      React.createElement("div", {className: this.props.screenClassName}, 
        closedCaptionOverlay, 
        React.createElement("div", {className: this.props.titleBarClassName}, 
          titleBar, 
          React.createElement(CloseButton, React.__spread({},  this.props, {closeAction: this.handleClose}))
        ), 

        this.props.children
      )
    );
  }
});

ContentScreen.propTypes = {
  element: React.PropTypes.element
};

ContentScreen.defaultProps = {
  screen: CONSTANTS.SCREEN.SHARE_SCREEN,
  screenClassName: 'oo-content-screen',
  titleBarClassName: 'oo-content-screen-title-bar',
  titleText: '',
  element: null,
  icon: 'share',
  controller: {
    toggleScreen: function(){},
    state: {
      accessibilityControlsEnabled: true
    }
  }
};

module.exports = ContentScreen;

},{"../components/closeButton":4,"../components/icon":22,"../components/utils":34,"../constants/constants":36,"../mixins/accessibilityMixin":38,"react":212}],45:[function(require,module,exports){
/********************************************************************
  END SCREEN
*********************************************************************/
var React = require('react'),
    ClassNames = require('classnames'),
    ControlBar = require('../components/controlBar'),
    Icon = require('../components/icon');

var EndScreen = React.createClass({displayName: "EndScreen",
  getInitialState: function() {
    return {
      controlBarVisible: true
    };
  },

  handleClick: function(event) {
    // pause or play the video if the skin is clicked
    event.preventDefault();
    this.props.controller.state.accessibilityControlsEnabled = true;
    this.props.controller.togglePlayPause();
  },

  render: function() {
    var actionIconStyle = {
      color: this.props.skinConfig.endScreen.replayIconStyle.color,
      opacity: this.props.skinConfig.endScreen.replayIconStyle.opacity
    };

    var actionIconClass = ClassNames({
      'oo-action-icon': true,
      'oo-hidden': !this.props.skinConfig.endScreen.showReplayButton
    });

    return (
      React.createElement("div", {className: "oo-state-screen oo-end-screen"}, 
        React.createElement("div", {className: "oo-underlay-gradient"}), 

        React.createElement("a", {className: "oo-state-screen-selectable", onClick: this.handleClick}), 

        React.createElement("a", {className: actionIconClass, onClick: this.handleClick}, 
          React.createElement(Icon, React.__spread({},  this.props, {icon: "replay", style: actionIconStyle}))
        ), 

        React.createElement("div", {className: "oo-interactive-container"}, 
          React.createElement(ControlBar, React.__spread({},  this.props, 
            {controlBarVisible: this.state.controlBarVisible, 
            playerState: this.props.playerState, 
            isLiveStream: this.props.isLiveStream}))
        )
      )
    );
  }
});
module.exports = EndScreen;

},{"../components/controlBar":17,"../components/icon":22,"classnames":51,"react":212}],46:[function(require,module,exports){
/********************************************************************
  ERROR SCREEN
*********************************************************************/
var React = require('react'),
    ClassNames = require('classnames'),
    CONSTANTS = require('../constants/constants'),
    Utils = require('../components/utils'),
    AccessibilityMixin = require('../mixins/accessibilityMixin');

var ErrorScreen = React.createClass({displayName: "ErrorScreen",
  mixins: [AccessibilityMixin],

  render: function() {
    var errorTitle, errorDescription, errorAction;
    if (CONSTANTS.ERROR_MESSAGE.hasOwnProperty(this.props.errorCode.code)){
      errorTitle = Utils.getLocalizedString(this.props.language, CONSTANTS.ERROR_MESSAGE[this.props.errorCode.code].title, this.props.localizableStrings)
      errorDescription = Utils.getLocalizedString(this.props.language, CONSTANTS.ERROR_MESSAGE[this.props.errorCode.code].description, this.props.localizableStrings);
      errorAction = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.ERROR_ACTION, this.props.localizableStrings);
    }
    else {
      errorDescription = Utils.getLocalizedString(this.props.language, CONSTANTS.SKIN_TEXT.UNKNOWN_ERROR, this.props.localizableStrings);
      errorTitle = null;
      errorAction = null;
    }

    var errorContentClass = ClassNames({
      'oo-error-content': true,
      'oo-center-block': true
    });

    return (
      React.createElement("div", {className: "oo-state-screen oo-error-screen"}, 
        React.createElement("div", {className: errorContentClass}, 
          React.createElement("div", {className: "oo-error-title oo-text-uppercase"}, errorTitle), 
          React.createElement("div", {className: "oo-error-description"}, errorDescription), 
          React.createElement("div", {className: "oo-error-action oo-text-uppercase"}, errorAction)
        )
      )
    );
  }
});

ErrorScreen.defaultProps = {
  controller: {
    state: {
      accessibilityControlsEnabled: true
    }
  }
};

module.exports = ErrorScreen;

},{"../components/utils":34,"../constants/constants":36,"../mixins/accessibilityMixin":38,"classnames":51,"react":212}],47:[function(require,module,exports){
/********************************************************************
 PAUSE SCREEN
 *********************************************************************/
var React = require('react'),
    ReactDOM = require('react-dom'),
    ClassNames = require('classnames'),
    ControlBar = require('../components/controlBar'),
    AdOverlay = require('../components/adOverlay'),
    UpNextPanel = require('../components/upNextPanel'),
    TextTrack = require('../components/textTrackPanel'),
    ResizeMixin = require('../mixins/resizeMixin'),
    Icon = require('../components/icon'),
    Utils = require('../components/utils'),
    AnimateMixin = require('../mixins/animateMixin');

var PauseScreen = React.createClass({displayName: "PauseScreen",
  mixins: [ResizeMixin, AnimateMixin],

  getInitialState: function() {
    return {
      descriptionText: this.props.contentTree.description,
      controlBarVisible: true
    };
  },

  componentDidMount: function() {
    this.handleResize();
  },

  componentWillUnmount: function() {
    this.props.controller.enablePauseAnimation();
  },

  handleResize: function() {
    if (ReactDOM.findDOMNode(this.refs.description)){
      this.setState({
        descriptionText: Utils.truncateTextToWidth(ReactDOM.findDOMNode(this.refs.description), this.props.contentTree.description)
      });
    }
  },

  handleClick: function(event) {
    event.preventDefault();
    this.props.controller.togglePlayPause();
    this.props.controller.state.accessibilityControlsEnabled = true;
  },

  render: function() {
    //inline style for config/skin.json elements only
    var titleStyle = {
      color: this.props.skinConfig.startScreen.titleFont.color
    };
    var descriptionStyle = {
      color: this.props.skinConfig.startScreen.descriptionFont.color
    };
    var actionIconStyle = {
      color: this.props.skinConfig.pauseScreen.PauseIconStyle.color,
      opacity: this.props.skinConfig.pauseScreen.PauseIconStyle.opacity
    };

    //CSS class manipulation from config/skin.json
    var fadeUnderlayClass = ClassNames({
      'oo-fading-underlay': !this.props.pauseAnimationDisabled,
      'oo-fading-underlay-active': this.props.pauseAnimationDisabled,
      'oo-animate-fade': this.state.animate && !this.props.pauseAnimationDisabled
    });
    var infoPanelClass = ClassNames({
      'oo-state-screen-info': true,
      'oo-info-panel-top': this.props.skinConfig.pauseScreen.infoPanelPosition.toLowerCase().indexOf("top") > -1,
      'oo-info-panel-bottom': this.props.skinConfig.pauseScreen.infoPanelPosition.toLowerCase().indexOf("bottom") > -1,
      'oo-info-panel-left': this.props.skinConfig.pauseScreen.infoPanelPosition.toLowerCase().indexOf("left") > -1,
      'oo-info-panel-right': this.props.skinConfig.pauseScreen.infoPanelPosition.toLowerCase().indexOf("right") > -1
    });
    var titleClass = ClassNames({
      'oo-state-screen-title': true,
      'oo-text-truncate': true,
      'oo-pull-right': this.props.skinConfig.pauseScreen.infoPanelPosition.toLowerCase().indexOf("right") > -1
    });
    var descriptionClass = ClassNames({
      'oo-state-screen-description': true,
      'oo-pull-right': this.props.skinConfig.pauseScreen.infoPanelPosition.toLowerCase().indexOf("right") > -1
    });
    var actionIconClass = ClassNames({
      'oo-action-icon-pause': !this.props.pauseAnimationDisabled,
      'oo-action-icon': this.props.pauseAnimationDisabled,
      'oo-animate-pause': this.state.animate && !this.props.pauseAnimationDisabled,
      'oo-action-icon-top': this.props.skinConfig.pauseScreen.pauseIconPosition.toLowerCase().indexOf("top") > -1,
      'oo-action-icon-bottom': this.props.skinConfig.pauseScreen.pauseIconPosition.toLowerCase().indexOf("bottom") > -1,
      'oo-action-icon-left': this.props.skinConfig.pauseScreen.pauseIconPosition.toLowerCase().indexOf("left") > -1,
      'oo-action-icon-right': this.props.skinConfig.pauseScreen.pauseIconPosition.toLowerCase().indexOf("right") > -1,
      'oo-hidden': !this.props.skinConfig.pauseScreen.showPauseIcon || this.props.pauseAnimationDisabled
    });

    var titleMetadata = (React.createElement("div", {className: titleClass, style: titleStyle}, this.props.contentTree.title));
    var descriptionMetadata = (React.createElement("div", {className: descriptionClass, ref: "description", style: descriptionStyle}, this.state.descriptionText));
    var adOverlay = (this.props.controller.state.adOverlayUrl && this.props.controller.state.showAdOverlay) ?
      React.createElement(AdOverlay, React.__spread({},  this.props, 
        {overlay: this.props.controller.state.adOverlayUrl, 
        showOverlay: this.props.controller.state.showAdOverlay, 
        showOverlayCloseButton: this.props.controller.state.showAdOverlayCloseButton})) : null;

    var upNextPanel = (this.props.controller.state.upNextInfo.showing && this.props.controller.state.upNextInfo.upNextData) ?
      React.createElement(UpNextPanel, React.__spread({},  this.props, 
        {controlBarVisible: this.state.controlBarVisible, 
        currentPlayhead: this.props.currentPlayhead})) : null;

    return (
      React.createElement("div", {className: "oo-state-screen oo-pause-screen"}, 
        React.createElement("div", {className: fadeUnderlayClass}), 
        React.createElement("div", {className: infoPanelClass}, 
          this.props.skinConfig.pauseScreen.showTitle ? titleMetadata : null, 
          this.props.skinConfig.pauseScreen.showDescription ? descriptionMetadata : null
        ), 

        React.createElement("a", {className: "oo-state-screen-selectable", onClick: this.handleClick}), 

        React.createElement("a", {className: actionIconClass, onClick: this.handleClick}, 
          React.createElement(Icon, React.__spread({},  this.props, {icon: "pause", style: actionIconStyle}))
        ), 

        React.createElement("div", {className: "oo-interactive-container"}, 

          React.createElement(TextTrack, {
            closedCaptionOptions: this.props.closedCaptionOptions, 
            cueText: this.props.closedCaptionOptions.cueText, 
            responsiveView: this.props.responsiveView}
          ), 

          React.createElement("a", {className: "oo-state-screen-selectable", onClick: this.handleClick}), 

          adOverlay, 

          upNextPanel, 

          React.createElement(ControlBar, React.__spread({},  this.props, 
            {controlBarVisible: this.state.controlBarVisible, 
            playerState: this.state.playerState, 
            isLiveStream: this.props.isLiveStream}))
        )
      )
    );
  }
});
module.exports = PauseScreen;

},{"../components/adOverlay":2,"../components/controlBar":17,"../components/icon":22,"../components/textTrackPanel":30,"../components/upNextPanel":33,"../components/utils":34,"../mixins/animateMixin":39,"../mixins/resizeMixin":40,"classnames":51,"react":212,"react-dom":55}],48:[function(require,module,exports){
/********************************************************************
  PLAYING SCREEN
*********************************************************************/
var React = require('react'),
    ReactDOM = require('react-dom'),
    ControlBar = require('../components/controlBar'),
    AdOverlay = require('../components/adOverlay'),
    UpNextPanel = require('../components/upNextPanel'),
    Spinner = require('../components/spinner'),
    TextTrack = require('../components/textTrackPanel'),
    ResizeMixin = require('../mixins/resizeMixin');

var PlayingScreen = React.createClass({displayName: "PlayingScreen",
  mixins: [ResizeMixin],

  getInitialState: function() {
    this.isMobile = this.props.controller.state.isMobile;
    this.browserSupportsTouch = this.props.controller.state.browserSupportsTouch;
    return {
      controlBarVisible: true,
      timer: null
    };
  },

  componentDidMount: function () {
    //for mobile or desktop fullscreen, hide control bar after 3 seconds
    if (this.isMobile || this.props.fullscreen || this.browserSupportsTouch){
      this.props.controller.startHideControlBarTimer();
    }
  },

  componentWillUpdate: function(nextProps) {
    if(nextProps) {
      if (nextProps.controller.state.controlBarVisible == false && this.state.controlBarVisible == true) {
        this.hideControlBar();
      }
      if(!this.props.fullscreen && nextProps.fullscreen) {
        this.props.controller.startHideControlBarTimer();
      }
      if(this.props.fullscreen && !nextProps.fullscreen && this.isMobile) {
        this.setState({controlBarVisible: true});
        this.props.controller.showControlBar();
        this.props.controller.startHideControlBarTimer();
      }
    }
  },

  componentWillUnmount: function () {
    this.props.controller.cancelTimer();
  },

  handleResize: function() {
    if (this.isMounted()) {
      this.props.controller.startHideControlBarTimer();
    }
  },

  handlePlayerMouseUp: function(event) {
    // pause or play the video if the skin is clicked on desktop
    if (!this.isMobile) {
      event.stopPropagation(); // W3C
      event.cancelBubble = true; // IE

      this.props.controller.togglePlayPause();
      this.props.controller.state.accessibilityControlsEnabled = true;
    }
    // for mobile, touch is handled in handleTouchEnd
  },

  handleTouchEnd: function(event) {
    event.preventDefault();//to prevent mobile from propagating click to discovery shown on pause
    if (!this.state.controlBarVisible){
      this.showControlBar(event);
      this.props.controller.startHideControlBarTimer();
    }
    else {
      this.props.controller.togglePlayPause();
    }
  },

  handlePlayerMouseMove: function() {
    if(!this.isMobile && this.props.fullscreen) {
      this.showControlBar();
      this.props.controller.startHideControlBarTimer();
    }
  },

  showControlBar: function(event) {
    if (!this.isMobile || event.type == 'touchend') {
      this.setState({controlBarVisible: true});
      this.props.controller.showControlBar();
      ReactDOM.findDOMNode(this.refs.PlayingScreen).style.cursor="auto";
    }
  },

  hideControlBar: function(event) {
    if (this.props.controlBarAutoHide == true && !(this.isMobile && event)) {
      this.setState({controlBarVisible: false});
      this.props.controller.hideControlBar();
      ReactDOM.findDOMNode(this.refs.PlayingScreen).style.cursor="none";
    }
  },

  render: function() {
    var adOverlay = (this.props.controller.state.adOverlayUrl && this.props.controller.state.showAdOverlay) ?
      React.createElement(AdOverlay, React.__spread({},  this.props, 
        {overlay: this.props.controller.state.adOverlayUrl, 
        showOverlay: this.props.controller.state.showAdOverlay, 
        showOverlayCloseButton: this.props.controller.state.showAdOverlayCloseButton})) : null;

    var upNextPanel = (this.props.controller.state.upNextInfo.showing && this.props.controller.state.upNextInfo.upNextData) ?
      React.createElement(UpNextPanel, React.__spread({},  this.props, 
        {controlBarVisible: this.state.controlBarVisible, 
        currentPlayhead: this.props.currentPlayhead})) : null;

    return (
    React.createElement("div", {className: "oo-state-screen oo-playing-screen", 
         ref: "PlayingScreen", 
         onMouseOver: this.showControlBar, 
         onMouseOut: this.hideControlBar, 
         onMouseMove: this.handlePlayerMouseMove}, 

      this.props.controller.state.buffering ? React.createElement(Spinner, {loadingImage: this.props.skinConfig.general.loadingImage.imageResource.url}) : null, 

      React.createElement("div", {className: "oo-state-screen-selectable", onMouseUp: this.handlePlayerMouseUp, onTouchEnd: this.handleTouchEnd}), 

      React.createElement("div", {className: "oo-interactive-container"}, 

        React.createElement(TextTrack, {
          closedCaptionOptions: this.props.closedCaptionOptions, 
          cueText: this.props.closedCaptionOptions.cueText, 
          responsiveView: this.props.responsiveView}
        ), 

        React.createElement("div", {className: "oo-state-screen-selectable", onMouseUp: this.handlePlayerMouseUp, onTouchEnd: this.handleTouchEnd}), 

        adOverlay, 

        upNextPanel, 

        React.createElement(ControlBar, React.__spread({},  this.props, 
          {controlBarVisible: this.state.controlBarVisible, 
          playerState: this.props.playerState, 
          isLiveStream: this.props.isLiveStream}))
      )
    )
    );
  }
});
module.exports = PlayingScreen;

},{"../components/adOverlay":2,"../components/controlBar":17,"../components/spinner":28,"../components/textTrackPanel":30,"../components/upNextPanel":33,"../mixins/resizeMixin":40,"react":212,"react-dom":55}],49:[function(require,module,exports){
var React = require('react');

var Popover = React.createClass({displayName: "Popover",

  render: function() {
    return (
      React.createElement("div", {className: "oo-popover"}, 
        this.props.children
      )
    );
  }
});

module.exports = Popover;

},{"react":212}],50:[function(require,module,exports){
/********************************************************************
 START SCREEN
 *********************************************************************/
var React = require('react'),
    ReactDOM = require('react-dom'),
    ClassNames = require('classnames'),
    CONSTANTS = require('../constants/constants'),
    Spinner = require('../components/spinner'),
    Icon = require('../components/icon'),
    ResizeMixin = require('../mixins/resizeMixin'),
    Utils = require('../components/utils');

var StartScreen = React.createClass({displayName: "StartScreen",
  mixins: [ResizeMixin],

  getInitialState: function() {
    return {
      playButtonClicked: false,
      descriptionText: this.props.contentTree.description
    };
  },

  componentDidMount: function() {
    this.handleResize();
  },

  handleResize: function() {
    if (ReactDOM.findDOMNode(this.refs.description)){
      this.setState({
        descriptionText: Utils.truncateTextToWidth(ReactDOM.findDOMNode(this.refs.description), this.props.contentTree.description)
      });
    }
  },

  handleClick: function(event) {
    event.preventDefault();
    this.props.controller.togglePlayPause();
    this.props.controller.state.accessibilityControlsEnabled = true;
    this.setState({playButtonClicked: true});
  },

  render: function() {
    //inline style for config/skin.json elements only
    var titleStyle = {
      color: this.props.skinConfig.startScreen.titleFont.color
    };
    var descriptionStyle = {
      color: this.props.skinConfig.startScreen.descriptionFont.color
    };
    var actionIconStyle = {
      color: this.props.skinConfig.startScreen.playIconStyle.color,
      opacity: this.props.skinConfig.startScreen.playIconStyle.opacity
    };
    var posterImageUrl = this.props.skinConfig.startScreen.showPromo ? this.props.contentTree.promo_image : '';
    var posterStyle = {
      backgroundImage: "url('" + posterImageUrl + "')"
    };

    //CSS class manipulation from config/skin.json
    var stateScreenPosterClass = ClassNames({
      'oo-state-screen-poster': this.props.skinConfig.startScreen.promoImageSize != "small",
      'oo-state-screen-poster-small': this.props.skinConfig.startScreen.promoImageSize == "small"
    });
    var infoPanelClass = ClassNames({
      'oo-state-screen-info': true,
      'oo-info-panel-top': this.props.skinConfig.startScreen.infoPanelPosition.toLowerCase().indexOf("top") > -1,
      'oo-info-panel-bottom': this.props.skinConfig.startScreen.infoPanelPosition.toLowerCase().indexOf("bottom") > -1,
      'oo-info-panel-left': this.props.skinConfig.startScreen.infoPanelPosition.toLowerCase().indexOf("left") > -1,
      'oo-info-panel-right': this.props.skinConfig.startScreen.infoPanelPosition.toLowerCase().indexOf("right") > -1
    });
    var titleClass = ClassNames({
      'oo-state-screen-title': true,
      'oo-text-truncate': true,
      'oo-pull-right': this.props.skinConfig.startScreen.infoPanelPosition.toLowerCase().indexOf("right") > -1
    });
    var descriptionClass = ClassNames({
      'oo-state-screen-description': true,
      'oo-pull-right': this.props.skinConfig.startScreen.infoPanelPosition.toLowerCase().indexOf("right") > -1
    });
    var actionIconClass = ClassNames({
      'oo-action-icon': true,
      'oo-action-icon-top': this.props.skinConfig.startScreen.playButtonPosition.toLowerCase().indexOf("top") > -1,
      'oo-action-icon-bottom': this.props.skinConfig.startScreen.playButtonPosition.toLowerCase().indexOf("bottom") > -1,
      'oo-action-icon-left': this.props.skinConfig.startScreen.playButtonPosition.toLowerCase().indexOf("left") > -1,
      'oo-action-icon-right': this.props.skinConfig.startScreen.playButtonPosition.toLowerCase().indexOf("right") > -1,
      'oo-hidden': !this.props.skinConfig.startScreen.showPlayButton
    });

    var titleMetadata = (React.createElement("div", {className: titleClass, style: titleStyle}, this.props.contentTree.title));
    var iconName = (this.props.controller.state.playerState == CONSTANTS.STATE.END ? "replay" : "play");
    var descriptionMetadata = (React.createElement("div", {className: descriptionClass, ref: "description", style: descriptionStyle}, this.state.descriptionText));

    var actionIcon = (
      React.createElement("a", {className: actionIconClass, onClick: this.handleClick}, 
        React.createElement(Icon, React.__spread({},  this.props, {icon: iconName, style: actionIconStyle}))
      )
    );
    return (
      React.createElement("div", {className: "oo-state-screen oo-start-screen"}, 
        React.createElement("div", {className: stateScreenPosterClass, style: posterStyle}, 
          React.createElement("div", {className: "oo-start-screen-linear-gradient"}), 
          React.createElement("a", {className: "oo-state-screen-selectable", onClick: this.handleClick})
        ), 
        React.createElement("div", {className: infoPanelClass}, 
          this.props.skinConfig.startScreen.showTitle ? titleMetadata : null, 
          this.props.skinConfig.startScreen.showDescription ? descriptionMetadata : null
        ), 

        (this.state.playButtonClicked && this.props.controller.state.playerState == CONSTANTS.STATE.START) || this.props.controller.state.buffering ?
          React.createElement(Spinner, {loadingImage: this.props.skinConfig.general.loadingImage.imageResource.url}) : actionIcon
      )
    );
  }
});

StartScreen.propTypes = {
  skinConfig: React.PropTypes.shape({
    startScreen: React.PropTypes.shape({
      playIconStyle: React.PropTypes.shape({
        color: React.PropTypes.string
      })
    }),
    icons: React.PropTypes.objectOf(React.PropTypes.object)
  })
};

StartScreen.defaultProps = {
  skinConfig: {
    general: {
      loadingImage: {
        imageResource: {
          url: null
        }
      }
    },
    startScreen: {
      titleFont: {
      },
      descriptionFont: {
      },
      playIconStyle: {
        color: 'white'
      },
      infoPanelPosition: 'topLeft',
      playButtonPosition: 'center',
      showPlayButton: true,
      showPromo: true,
      showTitle: true,
      showDescription: true,
      promoImageSize: 'default'
    },
    icons: {
      play:{fontStyleClass:'oo-icon oo-icon-play'},
      replay:{fontStyleClass:'oo-icon oo-icon-upnext-replay'}
    }
  },
  controller: {
    togglePlayPause: function(){},
    state: {
      playerState:'start',
      buffering: false
    }
  },
  contentTree: {
    promo_image: '',
    description:'',
    title:''
  }
};

module.exports = StartScreen;

},{"../components/icon":22,"../components/spinner":28,"../components/utils":34,"../constants/constants":36,"../mixins/resizeMixin":40,"classnames":51,"react":212,"react-dom":55}],51:[function(require,module,exports){
/*!
  Copyright (c) 2016 Jed Watson.
  Licensed under the MIT License (MIT), see
  http://jedwatson.github.io/classnames
*/
/* global define */

(function () {
	'use strict';

	var hasOwn = {}.hasOwnProperty;

	function classNames () {
		var classes = [];

		for (var i = 0; i < arguments.length; i++) {
			var arg = arguments[i];
			if (!arg) continue;

			var argType = typeof arg;

			if (argType === 'string' || argType === 'number') {
				classes.push(arg);
			} else if (Array.isArray(arg)) {
				classes.push(classNames.apply(null, arg));
			} else if (argType === 'object') {
				for (var key in arg) {
					if (hasOwn.call(arg, key) && arg[key]) {
						classes.push(key);
					}
				}
			}
		}

		return classes.join(' ');
	}

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = classNames;
	} else if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
		// register as 'classnames', consistent with npm package name
		define('classnames', [], function () {
			return classNames;
		});
	} else {
		window.classNames = classNames;
	}
}());

},{}],52:[function(require,module,exports){
/**
 * lodash 4.0.3 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Gets the timestamp of the number of milliseconds that have elapsed since
 * the Unix epoch (1 January 1970 00:00:00 UTC).
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Date
 * @returns {number} Returns the timestamp.
 * @example
 *
 * _.defer(function(stamp) {
 *   console.log(_.now() - stamp);
 * }, _.now());
 * // => logs the number of milliseconds it took for the deferred function to be invoked
 */
var now = Date.now;

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked. The debounced function comes with a `cancel` method to cancel
 * delayed `func` invocations and a `flush` method to immediately invoke them.
 * Provide an options object to indicate whether `func` should be invoked on
 * the leading and/or trailing edge of the `wait` timeout. The `func` is invoked
 * with the last arguments provided to the debounced function. Subsequent calls
 * to the debounced function return the result of the last `func` invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is invoked
 * on the trailing edge of the timeout only if the debounced function is
 * invoked more than once during the `wait` timeout.
 *
 * See [David Corbacho's article](http://drupalmotion.com/article/debounce-and-throttle-visual-explanation)
 * for details over the differences between `_.debounce` and `_.throttle`.
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to debounce.
 * @param {number} [wait=0] The number of milliseconds to delay.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.leading=false] Specify invoking on the leading
 *  edge of the timeout.
 * @param {number} [options.maxWait] The maximum time `func` is allowed to be
 *  delayed before it's invoked.
 * @param {boolean} [options.trailing=true] Specify invoking on the trailing
 *  edge of the timeout.
 * @returns {Function} Returns the new debounced function.
 * @example
 *
 * // Avoid costly calculations while the window size is in flux.
 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
 *
 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
 * jQuery(element).on('click', _.debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * }));
 *
 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
 * var source = new EventSource('/stream');
 * jQuery(source).on('message', debounced);
 *
 * // Cancel the trailing debounced invocation.
 * jQuery(window).on('popstate', debounced.cancel);
 */
function debounce(func, wait, options) {
  var args,
      maxTimeoutId,
      result,
      stamp,
      thisArg,
      timeoutId,
      trailingCall,
      lastCalled = 0,
      leading = false,
      maxWait = false,
      trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  wait = toNumber(wait) || 0;
  if (isObject(options)) {
    leading = !!options.leading;
    maxWait = 'maxWait' in options && nativeMax(toNumber(options.maxWait) || 0, wait);
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  function cancel() {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId);
    }
    lastCalled = 0;
    args = maxTimeoutId = thisArg = timeoutId = trailingCall = undefined;
  }

  function complete(isCalled, id) {
    if (id) {
      clearTimeout(id);
    }
    maxTimeoutId = timeoutId = trailingCall = undefined;
    if (isCalled) {
      lastCalled = now();
      result = func.apply(thisArg, args);
      if (!timeoutId && !maxTimeoutId) {
        args = thisArg = undefined;
      }
    }
  }

  function delayed() {
    var remaining = wait - (now() - stamp);
    if (remaining <= 0 || remaining > wait) {
      complete(trailingCall, maxTimeoutId);
    } else {
      timeoutId = setTimeout(delayed, remaining);
    }
  }

  function flush() {
    if ((timeoutId && trailingCall) || (maxTimeoutId && trailing)) {
      result = func.apply(thisArg, args);
    }
    cancel();
    return result;
  }

  function maxDelayed() {
    complete(trailing, timeoutId);
  }

  function debounced() {
    args = arguments;
    stamp = now();
    thisArg = this;
    trailingCall = trailing && (timeoutId || !leading);

    if (maxWait === false) {
      var leadingCall = leading && !timeoutId;
    } else {
      if (!lastCalled && !maxTimeoutId && !leading) {
        lastCalled = stamp;
      }
      var remaining = maxWait - (stamp - lastCalled);

      var isCalled = (remaining <= 0 || remaining > maxWait) &&
        (leading || maxTimeoutId);

      if (isCalled) {
        if (maxTimeoutId) {
          maxTimeoutId = clearTimeout(maxTimeoutId);
        }
        lastCalled = stamp;
        result = func.apply(thisArg, args);
      }
      else if (!maxTimeoutId) {
        maxTimeoutId = setTimeout(maxDelayed, remaining);
      }
    }
    if (isCalled && timeoutId) {
      timeoutId = clearTimeout(timeoutId);
    }
    else if (!timeoutId && wait !== maxWait) {
      timeoutId = setTimeout(delayed, wait);
    }
    if (leadingCall) {
      isCalled = true;
      result = func.apply(thisArg, args);
    }
    if (isCalled && !timeoutId && !maxTimeoutId) {
      args = thisArg = undefined;
    }
    return result;
  }
  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = debounce;

},{}],53:[function(require,module,exports){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var keys = require('lodash.keys');

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

/**
 * The base implementation of `_.values` and `_.valuesIn` which creates an
 * array of `object` property values corresponding to the property names
 * of `props`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} props The property names to get values for.
 * @returns {Object} Returns the array of property values.
 */
function baseValues(object, props) {
  return arrayMap(props, function(key) {
    return object[key];
  });
}

/**
 * Creates an array of the own enumerable property values of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property values.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.values(new Foo);
 * // => [1, 2] (iteration order is not guaranteed)
 *
 * _.values('hi');
 * // => ['h', 'i']
 */
function values(object) {
  return object ? baseValues(object, keys(object)) : [];
}

module.exports = values;

},{"lodash.keys":54}],54:[function(require,module,exports){
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Creates a function that invokes `func` with its first argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetPrototype = Object.getPrototypeOf,
    nativeKeys = Object.keys;

/**
 * The base implementation of `_.has` without support for deep paths.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHas(object, key) {
  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
  // that are composed entirely of index properties, return `false` for
  // `hasOwnProperty` checks of them.
  return object != null &&
    (hasOwnProperty.call(object, key) ||
      (typeof object == 'object' && key in object && getPrototype(object) === null));
}

/**
 * The base implementation of `_.keys` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
var baseKeys = overArg(nativeKeys, Object);

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a
 * [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792) that affects
 * Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Gets the `[[Prototype]]` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {null|Object} Returns the `[[Prototype]]`.
 */
var getPrototype = overArg(nativeGetPrototype, Object);

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value)) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array and weak map constructors,
  // and PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length,
 *  else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/6.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a string, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  var isProto = isPrototype(object);
  if (!(isProto || isArrayLike(object))) {
    return baseKeys(object);
  }
  var indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  for (var key in object) {
    if (baseHas(object, key) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(isProto && key == 'constructor')) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keys;

},{}],55:[function(require,module,exports){
'use strict';

module.exports = require('react/lib/ReactDOM');

},{"react/lib/ReactDOM":91}],56:[function(require,module,exports){
!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e(require("react")):"function"==typeof define&&define.amd?define(["react"],e):"object"==typeof exports?exports.ScrollArea=e(require("react")):t.ScrollArea=e(t.React)}(this,function(t){return function(t){function e(o){if(n[o])return n[o].exports;var r=n[o]={exports:{},id:o,loaded:!1};return t[o].call(r.exports,r,r.exports,e),r.loaded=!0,r.exports}var n={};return e.m=t,e.c=n,e.p="",e(0)}([function(t,e,n){"use strict";var o=n(2).default;Object.defineProperty(e,"__esModule",{value:!0});var r=n(20),i=o(r);e.default=i.default,t.exports=e.default},function(t,e){var n=Object;t.exports={create:n.create,getProto:n.getPrototypeOf,isEnum:{}.propertyIsEnumerable,getDesc:n.getOwnPropertyDescriptor,setDesc:n.defineProperty,setDescs:n.defineProperties,getKeys:n.keys,getNames:n.getOwnPropertyNames,getSymbols:n.getOwnPropertySymbols,each:[].forEach}},function(t,e){"use strict";e.default=function(t){return t&&t.__esModule?t:{"default":t}},e.__esModule=!0},function(t,e){var n=t.exports={version:"1.2.1"};"number"==typeof __e&&(__e=n)},function(e,n){e.exports=t},function(t,e,n){var o=n(38),r=n(3),i="prototype",a=function(t,e){return function(){return t.apply(e,arguments)}},s=function(t,e,n){var l,u,c,f,p=t&s.G,d=t&s.P,h=p?o:t&s.S?o[e]:(o[e]||{})[i],v=p?r:r[e]||(r[e]={});p&&(n=e);for(l in n)u=!(t&s.F)&&h&&l in h,u&&l in v||(c=u?h[l]:n[l],p&&"function"!=typeof h[l]?f=n[l]:t&s.B&&u?f=a(c,o):t&s.W&&h[l]==c?!function(t){f=function(e){return this instanceof t?new t(e):t(e)},f[i]=t[i]}(c):f=d&&"function"==typeof c?a(Function.call,c):c,v[l]=f,d&&((v[i]||(v[i]={}))[l]=c))};s.F=1,s.G=2,s.S=4,s.P=8,s.B=16,s.W=32,t.exports=s},function(t,e,n){"use strict";function o(t){return p?f.default.findDOMNode(t):t}function r(){d||p||(d=!0,console.error("With React 0.14 and later versions, you no longer need to wrap <ScrollArea> child into a function."))}function i(){!d&&p&&(d=!0,console.error("With React 0.13, you need to wrap <ScrollArea> child into a function."))}function a(t){return 0>t?0:t}function s(t){var e=arguments.length<=1||void 0===arguments[1]?function(t){return t}:arguments[1],n={};for(var o in t)t.hasOwnProperty(o)&&(n[o]=e(t[o]));return n}function l(t){var e=t.version;if("string"!=typeof e)return!0;var n=e.split("."),o=parseInt(n[0],10),r=parseInt(n[1],10);return 0===o&&13===r}var u=n(2).default;Object.defineProperty(e,"__esModule",{value:!0}),e.findDOMNode=o,e.warnAboutFunctionChild=r,e.warnAboutElementChild=i,e.positiveOrZero=a,e.modifyObjValues=s,e.isReact13=l;var c=n(4),f=u(c),p=l(f.default),d=!1},function(t,e){"use strict";e.default=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},e.__esModule=!0},function(t,e,n){"use strict";var o=n(24).default;e.default=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),o(t,r.key,r)}}return function(e,n,o){return n&&t(e.prototype,n),o&&t(e,o),e}}(),e.__esModule=!0},function(t,e,n){"use strict";var o=n(22).default;e.default=o||function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(t[o]=n[o])}return t},e.__esModule=!0},function(t,e,n){"use strict";var o=n(25).default;e.default=function(t,e,n){for(var r=!0;r;){var i=t,a=e,s=n;l=c=u=void 0,r=!1,null===i&&(i=Function.prototype);var l=o(i,a);if(void 0!==l){if("value"in l)return l.value;var u=l.get;return void 0===u?void 0:u.call(s)}var c=Object.getPrototypeOf(i);if(null===c)return void 0;t=c,e=a,n=s,r=!0}},e.__esModule=!0},function(t,e,n){"use strict";var o=n(23).default,r=n(26).default;e.default=function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=o(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(r?r(t,e):t.__proto__=e)},e.__esModule=!0},function(t,e){t.exports=function(t){if(void 0==t)throw TypeError("Can't call method on  "+t);return t}},function(t,e){t.exports=function(t){try{return!!t()}catch(e){return!0}}},function(t,e,n){var o=n(35);t.exports=0 in Object("z")?Object:function(t){return"String"==o(t)?t.split(""):Object(t)}},function(t,e){t.exports=function(t){return"object"==typeof t?null!==t:"function"==typeof t}},function(t,e){"use strict";e.__esModule=!0,e.default={noWobble:[170,26],gentle:[120,14],wobbly:[180,12],stiff:[210,20]},t.exports=e.default},function(t,e,n){"use strict";function o(t){return t&&t.__esModule?t:{"default":t}}e.__esModule=!0;var r=n(4),i=o(r),a=n(50),s=o(a),l=n(55),u=o(l),c=s.default(i.default),f=c.Spring,p=c.TransitionSpring,d=c.Motion,h=c.StaggeredMotion,v=c.TransitionMotion;e.Spring=f,e.TransitionSpring=p,e.Motion=d,e.StaggeredMotion=h,e.TransitionMotion=v;var y=n(18),m=o(y);e.spring=m.default;var g=n(16),S=o(g);e.presets=S.default;var b={reorderKeys:u.default};e.utils=b},function(t,e,n){"use strict";function o(t){return t&&t.__esModule?t:{"default":t}}function r(t){var e=arguments.length<=1||void 0===arguments[1]?a.default.noWobble:arguments[1];return{val:t,config:e}}e.__esModule=!0,e.default=r;var i=n(16),a=o(i);t.exports=e.default},function(t,e,n){(function(e){(function(){var n,o,r;"undefined"!=typeof performance&&null!==performance&&performance.now?t.exports=function(){return performance.now()}:"undefined"!=typeof e&&null!==e&&e.hrtime?(t.exports=function(){return(n()-r)/1e6},o=e.hrtime,n=function(){var t;return t=o(),1e9*t[0]+t[1]},r=n()):Date.now?(t.exports=function(){return Date.now()-r},r=Date.now()):(t.exports=function(){return(new Date).getTime()-r},r=(new Date).getTime())}).call(this)}).call(e,n(61))},function(t,e,n){"use strict";var o=n(10).default,r=n(11).default,i=n(8).default,a=n(7).default,s=n(9).default,l=n(2).default;Object.defineProperty(e,"__esModule",{value:!0});var u=n(4),c=l(u),f=n(21),p=l(f),d=n(6),h=n(47),v=l(h),y=n(17),m={wheel:"wheel",api:"api",touch:"touch",touchEnd:"touchEnd",mousemove:"mousemove"},g=function(t){function e(t){var n=this;a(this,e),o(Object.getPrototypeOf(e.prototype),"constructor",this).call(this,t),this.state={topPosition:0,leftPosition:0,realHeight:0,containerHeight:0,realWidth:0,containerWidth:0},this.scrollArea={refresh:function(){n.setSizesToState()},scrollTop:function(){n.scrollTop()},scrollBottom:function(){n.scrollBottom()},scrollYTo:function(t){n.scrollYTo(t)},scrollLeft:function(){n.scrollLeft()},scrollRight:function(){n.scrollRight()},scrollXTo:function(t){n.scrollXTo(t)}},this.evntsPreviousValues={clientX:0,clientY:0,deltaX:0,deltaY:0},this.bindedHandleWindowResize=this.handleWindowResize.bind(this)}return r(e,t),i(e,[{key:"getChildContext",value:function(){return{scrollArea:this.scrollArea}}},{key:"componentDidMount",value:function(){this.props.contentWindow&&this.props.contentWindow.addEventListener("resize",this.bindedHandleWindowResize),this.lineHeightPx=v.default(d.findDOMNode(this.content)),this.setSizesToState()}},{key:"componentWillUnmount",value:function(){this.props.contentWindow&&this.props.contentWindow.removeEventListener("resize",this.bindedHandleWindowResize)}},{key:"componentDidUpdate",value:function(){this.setSizesToState()}},{key:"render",value:function(){var t=this,e=this.props,n=e.children,o=e.className,r=e.contentClassName,i=e.ownerDocument,a=this.props.smoothScrolling&&(this.state.eventType===m.wheel||this.state.eventType===m.api||this.state.eventType===m.touchEnd),l=this.canScrollY()?c.default.createElement(p.default,{ownerDocument:i,realSize:this.state.realHeight,containerSize:this.state.containerHeight,position:this.state.topPosition,onMove:this.handleScrollbarMove.bind(this),onPositionChange:this.handleScrollbarYPositionChange.bind(this),containerStyle:this.props.verticalContainerStyle,scrollbarStyle:this.props.verticalScrollbarStyle,smoothScrolling:a,minScrollSize:this.props.minScrollSize,type:"vertical"}):null,u=this.canScrollX()?c.default.createElement(p.default,{ownerDocument:i,realSize:this.state.realWidth,containerSize:this.state.containerWidth,position:this.state.leftPosition,onMove:this.handleScrollbarMove.bind(this),onPositionChange:this.handleScrollbarXPositionChange.bind(this),containerStyle:this.props.horizontalContainerStyle,scrollbarStyle:this.props.horizontalScrollbarStyle,smoothScrolling:a,minScrollSize:this.props.minScrollSize,type:"horizontal"}):null;"function"==typeof n?(d.warnAboutFunctionChild(),n=n()):d.warnAboutElementChild();var f="scrollarea "+(o||""),h="scrollarea-content "+(r||""),v={marginTop:-this.state.topPosition,marginLeft:-this.state.leftPosition},g=a?d.modifyObjValues(v,function(t){return y.spring(t)}):v;return c.default.createElement(y.Motion,{style:s({},this.props.contentStyle,g)},function(e){return c.default.createElement("div",{ref:function(e){return t.wrapper=e},style:t.props.style,className:f,onWheel:t.handleWheel.bind(t)},c.default.createElement("div",{ref:function(e){return t.content=e},style:e,className:h,onTouchStart:t.handleTouchStart.bind(t),onTouchMove:t.handleTouchMove.bind(t),onTouchEnd:t.handleTouchEnd.bind(t)},n),l,u)})}},{key:"setStateFromEvent",value:function(t,e){this.props.onScroll&&this.props.onScroll(t),this.setState(s({},t,{eventType:e}))}},{key:"handleTouchStart",value:function(t){var e=t.touches;if(1===e.length){var n=e[0],o=n.clientX,r=n.clientY;this.eventPreviousValues=s({},this.eventPreviousValues,{clientY:r,clientX:o,timestamp:Date.now()})}}},{key:"handleTouchMove",value:function(t){t.preventDefault();var e=t.touches;if(1===e.length){var n=e[0],o=n.clientX,r=n.clientY,i=this.eventPreviousValues.clientY-r,a=this.eventPreviousValues.clientX-o;this.eventPreviousValues=s({},this.eventPreviousValues,{deltaY:i,deltaX:a,clientY:r,clientX:o,timestamp:Date.now()}),this.setStateFromEvent(this.composeNewState(-a,-i))}}},{key:"handleTouchEnd",value:function(t){var e=this.eventPreviousValues,n=e.deltaX,o=e.deltaY,r=e.timestamp;Date.now()-r<200&&this.setStateFromEvent(this.composeNewState(10*-n,10*-o),m.touchEnd),this.eventPreviousValues=s({},this.eventPreviousValues,{deltaY:0,deltaX:0})}},{key:"handleScrollbarMove",value:function(t,e){this.setStateFromEvent(this.composeNewState(e,t))}},{key:"handleScrollbarXPositionChange",value:function(t){this.scrollXTo(t)}},{key:"handleScrollbarYPositionChange",value:function(t){this.scrollYTo(t)}},{key:"handleWheel",value:function(t){var e=t.deltaY,n=t.deltaX;if(this.props.swapWheelAxes){var o=[n,e];e=o[0],n=o[1]}1===t.deltaMode&&(e*=this.lineHeightPx,n*=this.lineHeightPx),e*=this.props.speed,n*=this.props.speed;var r=this.composeNewState(-n,-e);(this.state.topPosition!==r.topPosition||this.state.leftPosition!==r.leftPosition)&&t.preventDefault(),this.setStateFromEvent(r,m.wheel)}},{key:"handleWindowResize",value:function(){var t=this.computeSizes();t=this.getModifiedPositionsIfNeeded(t),this.setStateFromEvent(t)}},{key:"composeNewState",value:function(t,e){var n=this.computeSizes();return this.canScrollY(n)&&(n.topPosition=this.computeTopPosition(e,n)),this.canScrollX(n)&&(n.leftPosition=this.computeLeftPosition(t,n)),n}},{key:"computeTopPosition",value:function(t,e){var n=this.state.topPosition-t;return this.normalizeTopPosition(n,e)}},{key:"computeLeftPosition",value:function(t,e){var n=this.state.leftPosition-t;return this.normalizeLeftPosition(n,e)}},{key:"normalizeTopPosition",value:function(t,e){return t>e.realHeight-e.containerHeight&&(t=e.realHeight-e.containerHeight),0>t&&(t=0),t}},{key:"normalizeLeftPosition",value:function(t,e){return t>e.realWidth-e.containerWidth?t=e.realWidth-e.containerWidth:0>t&&(t=0),t}},{key:"computeSizes",value:function(){var t=this.content.offsetHeight,e=this.wrapper.offsetHeight,n=this.content.offsetWidth,o=this.wrapper.offsetWidth;return{realHeight:t,containerHeight:e,realWidth:n,containerWidth:o}}},{key:"setSizesToState",value:function(){var t=this.computeSizes();(t.realHeight!==this.state.realHeight||t.realWidth!==this.state.realWidth)&&this.setStateFromEvent(this.getModifiedPositionsIfNeeded(t))}},{key:"scrollTop",value:function(){this.scrollYTo(0)}},{key:"scrollBottom",value:function(){this.scrollYTo(this.state.realHeight-this.state.containerHeight)}},{key:"scrollLeft",value:function(){this.scrollXTo(0)}},{key:"scrollRight",value:function(){this.scrollXTo(this.state.realWidth-this.state.containerWidth)}},{key:"scrollYTo",value:function(t){if(this.canScrollY()){var e=this.normalizeTopPosition(t,this.computeSizes());this.setStateFromEvent({topPosition:e},m.api)}}},{key:"scrollXTo",value:function(t){if(this.canScrollX()){var e=this.normalizeLeftPosition(t,this.computeSizes());this.setStateFromEvent({leftPosition:e},m.api)}}},{key:"canScrollY",value:function(){var t=arguments.length<=0||void 0===arguments[0]?this.state:arguments[0],e=t.realHeight>t.containerHeight;return e&&this.props.vertical}},{key:"canScrollX",value:function(){var t=arguments.length<=0||void 0===arguments[0]?this.state:arguments[0],e=t.realWidth>t.containerWidth;return e&&this.props.horizontal}},{key:"getModifiedPositionsIfNeeded",value:function(t){var e=t.realHeight-t.containerHeight;this.state.topPosition>=e&&(t.topPosition=this.canScrollY(t)?d.positiveOrZero(e):0);var n=t.realWidth-t.containerWidth;return this.state.leftPosition>=n&&(t.leftPosition=this.canScrollX(t)?d.positiveOrZero(n):0),t}}]),e}(c.default.Component);e.default=g,g.childContextTypes={scrollArea:c.default.PropTypes.object},g.propTypes={className:c.default.PropTypes.string,style:c.default.PropTypes.object,speed:c.default.PropTypes.number,contentClassName:c.default.PropTypes.string,contentStyle:c.default.PropTypes.object,vertical:c.default.PropTypes.bool,verticalContainerStyle:c.default.PropTypes.object,verticalScrollbarStyle:c.default.PropTypes.object,horizontal:c.default.PropTypes.bool,horizontalContainerStyle:c.default.PropTypes.object,horizontalScrollbarStyle:c.default.PropTypes.object,onScroll:c.default.PropTypes.func,contentWindow:c.default.PropTypes.any,ownerDocument:c.default.PropTypes.any,smoothScrolling:c.default.PropTypes.bool,minScrollSize:c.default.PropTypes.number,swapWheelAxes:c.default.PropTypes.bool},g.defaultProps={speed:1,vertical:!0,horizontal:!0,smoothScrolling:!1,swapWheelAxes:!1,contentWindow:"object"==typeof window?window:void 0,ownerDocument:"object"==typeof document?document:void 0},t.exports=e.default},function(t,e,n){"use strict";var o=n(10).default,r=n(11).default,i=n(8).default,a=n(7).default,s=n(9).default,l=n(2).default;Object.defineProperty(e,"__esModule",{value:!0});var u=n(4),c=l(u),f=n(17),p=n(6),d=function(t){function e(t){a(this,e),o(Object.getPrototypeOf(e.prototype),"constructor",this).call(this,t);var n=this.calculateState(t);this.state={position:n.position,scrollSize:n.scrollSize,isDragging:!1,lastClientPosition:0},"vertical"===t.type?this.bindedHandleMouseMove=this.handleMouseMoveForVertical.bind(this):this.bindedHandleMouseMove=this.handleMouseMoveForHorizontal.bind(this),this.bindedHandleMouseUp=this.handleMouseUp.bind(this)}return r(e,t),i(e,[{key:"componentDidMount",value:function(){this.props.ownerDocument&&(this.props.ownerDocument.addEventListener("mousemove",this.bindedHandleMouseMove),this.props.ownerDocument.addEventListener("mouseup",this.bindedHandleMouseUp))}},{key:"componentWillReceiveProps",value:function(t){this.setState(this.calculateState(t))}},{key:"componentWillUnmount",value:function(){this.props.ownerDocument&&(this.props.ownerDocument.removeEventListener("mousemove",this.bindedHandleMouseMove),this.props.ownerDocument.removeEventListener("mouseup",this.bindedHandleMouseUp))}},{key:"calculateFractionalPosition",value:function(t,e,n){var o=t-e;return 1-(o-n)/o}},{key:"calculateState",value:function(t){var e=this.calculateFractionalPosition(t.realSize,t.containerSize,t.position),n=t.containerSize*t.containerSize/t.realSize,o=n<t.minScrollSize?t.minScrollSize:n,r=(t.containerSize-o)*e;return{scrollSize:o,position:Math.round(r)}}},{key:"render",value:function(){var t=this,e=this.props,n=e.smoothScrolling,o=e.isDragging,r=e.type,i=e.scrollbarStyle,a=e.containerStyle,l="horizontal"===r,u="vertical"===r,d=this.createScrollStyles(),h=n?p.modifyObjValues(d,function(t){return f.spring(t)}):d,v="scrollbar-container "+(o?"active":"")+" "+(l?"horizontal":"")+" "+(u?"vertical":"");return c.default.createElement(f.Motion,{style:s({},i,h)},function(e){return c.default.createElement("div",{className:v,style:a,onMouseDown:t.handleScrollBarContainerClick.bind(t),ref:function(e){t.scrollbarContainer=e}},c.default.createElement("div",{className:"scrollbar",style:e,onMouseDown:t.handleMouseDown.bind(t)}))})}},{key:"handleScrollBarContainerClick",value:function(t){t.preventDefault();var e=this.computeMultiplier(),n=this.isVertical()?t.clientY:t.clientX,o=this.scrollbarContainer.getBoundingClientRect(),r=o.top,i=o.left,a=this.isVertical()?r:i,s=n-a,l=this.props.containerSize*this.props.containerSize/this.props.realSize;this.setState({isDragging:!0,lastClientPosition:n}),this.props.onPositionChange((s-l/2)/e)}},{key:"handleMouseMoveForHorizontal",value:function(t){var e=this.computeMultiplier();if(this.state.isDragging){t.preventDefault();var n=this.state.lastClientPosition-t.clientX;this.setState({lastClientPosition:t.clientX}),this.props.onMove(0,n/e)}}},{key:"handleMouseMoveForVertical",value:function(t){var e=this.computeMultiplier();if(this.state.isDragging){t.preventDefault();var n=this.state.lastClientPosition-t.clientY;this.setState({lastClientPosition:t.clientY}),this.props.onMove(n/e,0)}}},{key:"handleMouseDown",value:function(t){t.preventDefault(),t.stopPropagation();var e=this.isVertical()?t.clientY:t.clientX;this.setState({isDragging:!0,lastClientPosition:e})}},{key:"handleMouseUp",value:function(t){t.preventDefault(),this.setState({isDragging:!1})}},{key:"createScrollStyles",value:function(){return"vertical"===this.props.type?{height:this.state.scrollSize,marginTop:this.state.position}:{width:this.state.scrollSize,marginLeft:this.state.position}}},{key:"computeMultiplier",value:function(){return this.props.containerSize/this.props.realSize}},{key:"isVertical",value:function(){return"vertical"===this.props.type}}]),e}(c.default.Component);d.propTypes={onMove:c.default.PropTypes.func,onPositionChange:c.default.PropTypes.func,realSize:c.default.PropTypes.number,containerSize:c.default.PropTypes.number,position:c.default.PropTypes.number,containerStyle:c.default.PropTypes.object,scrollbarStyle:c.default.PropTypes.object,type:c.default.PropTypes.oneOf(["vertical","horizontal"]),ownerDocument:c.default.PropTypes.any,smoothScrolling:c.default.PropTypes.bool,minScrollSize:c.default.PropTypes.number},d.defaultProps={type:"vertical",smoothScrolling:!1},e.default=d,t.exports=e.default},function(t,e,n){t.exports={"default":n(27),__esModule:!0}},function(t,e,n){t.exports={"default":n(28),__esModule:!0}},function(t,e,n){t.exports={"default":n(29),__esModule:!0}},function(t,e,n){t.exports={"default":n(30),__esModule:!0}},function(t,e,n){t.exports={"default":n(31),__esModule:!0}},function(t,e,n){n(44),t.exports=n(3).Object.assign},function(t,e,n){var o=n(1);t.exports=function(t,e){return o.create(t,e)}},function(t,e,n){var o=n(1);t.exports=function(t,e,n){return o.setDesc(t,e,n)}},function(t,e,n){var o=n(1);n(45),t.exports=function(t,e){return o.getDesc(t,e)}},function(t,e,n){n(46),t.exports=n(3).Object.setPrototypeOf},function(t,e){t.exports=function(t){if("function"!=typeof t)throw TypeError(t+" is not a function!");return t}},function(t,e,n){var o=n(15);t.exports=function(t){if(!o(t))throw TypeError(t+" is not an object!");return t}},function(t,e,n){var o=n(43),r=n(14),i=n(37),a=n(39);t.exports=n(13)(function(){var t=Object.assign,e={},n={},o=Symbol(),r="abcdefghijklmnopqrst";return e[o]=7,r.split("").forEach(function(t){n[t]=t}),7!=t({},e)[o]||Object.keys(t({},n)).join("")!=r})?function(t,e){for(var n=o(t),s=arguments.length,l=1;s>l;)for(var u,c=r(arguments[l++]),f=i(c),p=f.length,d=0;p>d;)a(c,u=f[d++])&&(n[u]=c[u]);return n}:Object.assign},function(t,e){var n={}.toString;t.exports=function(t){return n.call(t).slice(8,-1)}},function(t,e,n){var o=n(32);t.exports=function(t,e,n){if(o(t),void 0===e)return t;switch(n){case 1:return function(n){return t.call(e,n)};case 2:return function(n,o){return t.call(e,n,o)};case 3:return function(n,o,r){return t.call(e,n,o,r)}}return function(){return t.apply(e,arguments)}}},function(t,e,n){var o=n(1);t.exports=function(t){var e=o.getKeys(t),n=o.getSymbols;if(n)for(var r,i=n(t),a=o.isEnum,s=0;i.length>s;)a.call(t,r=i[s++])&&e.push(r);return e}},function(t,e){var n="undefined",o=t.exports=typeof window!=n&&window.Math==Math?window:typeof self!=n&&self.Math==Math?self:Function("return this")();"number"==typeof __g&&(__g=o)},function(t,e){var n={}.hasOwnProperty;t.exports=function(t,e){return n.call(t,e)}},function(t,e,n){t.exports=function(t,e){var o=n(5),r=(n(3).Object||{})[t]||Object[t],i={};i[t]=e(r),o(o.S+o.F*n(13)(function(){r(1)}),"Object",i)}},function(t,e,n){var o=n(1).getDesc,r=n(15),i=n(33),a=function(t,e){if(i(t),!r(e)&&null!==e)throw TypeError(e+": can't set as prototype!")};t.exports={set:Object.setPrototypeOf||("__proto__"in{}?function(t,e,r){try{r=n(36)(Function.call,o(Object.prototype,"__proto__").set,2),r(t,[]),e=!(t instanceof Array)}catch(i){e=!0}return function(t,n){return a(t,n),e?t.__proto__=n:r(t,n),t}}({},!1):void 0),check:a}},function(t,e,n){var o=n(14),r=n(12);t.exports=function(t){return o(r(t))}},function(t,e,n){var o=n(12);t.exports=function(t){return Object(o(t))}},function(t,e,n){var o=n(5);o(o.S+o.F,"Object",{assign:n(34)})},function(t,e,n){var o=n(42);n(40)("getOwnPropertyDescriptor",function(t){return function(e,n){return t(o(e),n)}})},function(t,e,n){var o=n(5);o(o.S,"Object",{setPrototypeOf:n(41).set})},function(t,e,n){function o(t){var e=r(t,"line-height"),n=parseFloat(e,10);if(e===n+""){var o=t.style.lineHeight;t.style.lineHeight=e+"em",e=r(t,"line-height"),n=parseFloat(e,10),o?t.style.lineHeight=o:delete t.style.lineHeight}if(-1!==e.indexOf("pt")?(n*=4,n/=3):-1!==e.indexOf("mm")?(n*=96,n/=25.4):-1!==e.indexOf("cm")?(n*=96,n/=2.54):-1!==e.indexOf("in")?n*=96:-1!==e.indexOf("pc")&&(n*=16),n=Math.round(n),"normal"===e){var i=t.nodeName,a=document.createElement(i);a.innerHTML="&nbsp;";var s=r(t,"font-size");a.style.fontSize=s;var l=document.body;l.appendChild(a);var u=a.offsetHeight;n=u,l.removeChild(a)}return n}var r=n(48);t.exports=o},function(t,e){var n=function(t,e,n){return n=window.getComputedStyle,(n?n(t):t.currentStyle)[e.replace(/-(\w)/gi,function(t,e){return e.toUpperCase()})]};t.exports=n},function(t,e,n){"use strict";function o(t){return t&&t.__esModule?t:{"default":t}}function r(){function t(){var e=h(),n=e-m;m=e,g+=n*s,g>r*c&&(g=0);for(var o=Math.ceil(g/r),i=0;i<v.length;i++){var a=v[i],l=a.active,u=a.animationStep,f=a.prevState,d=v[i].nextState;if(l)if(0>=g)v[i].nextState=u(r/1e3,f);else for(var S=0;o>S;S++){v[i].nextState=u(r/1e3,d);var b=[d,v[i].nextState];v[i].prevState=b[0],d=b[1]}}g-=o*r;for(var w=1+g/r,i=0;i<v.length;i++){var P=v[i],M=P.animationRender,T=P.nextState,x=P.prevState;M(w,T,x)}v=v.filter(function(t){var e=t.active;return e}),0===v.length?y=!1:p(t)}function e(){y||(y=!0,m=h(),g=0,p(t))}var n=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],o=n.timeStep,r=void 0===o?1/60*1e3:o,i=n.timeScale,s=void 0===i?1:i,u=n.maxSteps,c=void 0===u?10:u,f=n.raf,p=void 0===f?l.default:f,d=n.now,h=void 0===d?a.default:d,v=[],y=!1,m=0,g=0;return function(t,n,o){for(var r=0;r<v.length;r++){var i=v[r];if(i.animationStep===n)return i.active=!0,i.prevState=t,e(),i.stop}var a={animationStep:n,animationRender:o,prevState:t,nextState:t,active:!0};return a.stop=function(){return a.active=!1},v.push(a),e(),a.stop}}e.__esModule=!0,e.default=r;var i=n(19),a=o(i),s=n(60),l=o(s);t.exports=e.default},function(t,e,n){"use strict";function o(t){return t&&t.__esModule?t:{"default":t}}function r(t,e){var n={};for(var o in e)e.hasOwnProperty(o)&&(n[o]=t(e[o],o));return n}function i(t,e){for(var n in e)if(e.hasOwnProperty(n)&&!t(e[n],n))return!1;return!0}function a(t){var e=t.PropTypes,n=t.createClass({displayName:"Motion",propTypes:{defaultValue:function(t,e){return t[e]?new Error("Spring's `defaultValue` has been changed to `defaultStyle`. Its format received a few (easy to update!) changes as well."):void 0},endValue:function(t,e){return t[e]?new Error("Spring's `endValue` has been changed to `style`. Its format received a few (easy to update!) changes as well."):void 0},defaultStyle:e.object,style:e.object.isRequired,children:e.func.isRequired},getInitialState:function(){var t=this.props,e=t.defaultStyle,n=t.style,o=e||n;return{currentStyle:o,currentVelocity:r(m.default,o)}},componentDidMount:function(){this.startAnimating()},componentWillReceiveProps:function(){this.startAnimating()},animationStep:function(t,e){var n=e.currentStyle,o=e.currentVelocity,r=this.props.style,i=g.updateCurrentStyle(t,n,o,r),a=g.updateCurrentVelocity(t,n,o,r);return u.default(o,i)&&u.default(a,i)&&this.stopAnimation(),{currentStyle:i,currentVelocity:a}},stopAnimation:null,hasUnmounted:!1,componentWillUnmount:function(){this.stopAnimation(),this.hasUnmounted=!0},startAnimating:function(){this.stopAnimation=M(this.state,this.animationStep,this.animationRender)},animationRender:function(t,e,n){this.hasUnmounted||this.setState({currentStyle:g.interpolateValue(t,e.currentStyle,n.currentStyle),currentVelocity:e.currentVelocity})},render:function(){var e=P.default(this.state.currentStyle),n=this.props.children(e);return n&&t.Children.only(n)}}),o=t.createClass({displayName:"StaggeredMotion",propTypes:{defaultStyle:function(t,e){return t[e]?new Error('You forgot the "s" for `StaggeredMotion`\'s `defaultStyles`.'):void 0},style:function(t,e){return t[e]?new Error('You forgot the "s" for `StaggeredMotion`\'s `styles`.'):void 0},defaultStyles:e.arrayOf(e.object),styles:e.func.isRequired,children:e.func.isRequired},getInitialState:function(){var t=this.props,e=t.styles,n=t.defaultStyles,o=n?n:e();return{currentStyles:o,currentVelocities:o.map(function(t){return r(m.default,t)})}},componentDidMount:function(){this.startAnimating()},componentWillReceiveProps:function(){this.startAnimating()},animationStep:function(t,e){var n=e.currentStyles,o=e.currentVelocities,r=this.props.styles(n.map(P.default)),i=n.map(function(e,n){return g.updateCurrentStyle(t,e,o[n],r[n])}),a=n.map(function(e,n){return g.updateCurrentVelocity(t,e,o[n],r[n])});return o.every(function(t,e){return u.default(t,n[e])})&&a.every(function(t,e){return u.default(t,i[e])})&&this.stopAnimation(),{currentStyles:i,currentVelocities:a}},stopAnimation:null,hasUnmounted:!1,componentWillUnmount:function(){this.stopAnimation(),this.hasUnmounted=!0},startAnimating:function(){this.stopAnimation=M(this.state,this.animationStep,this.animationRender)},animationRender:function(t,e,n){if(!this.hasUnmounted){var o=e.currentStyles.map(function(e,o){return g.interpolateValue(t,e,n.currentStyles[o])});this.setState({currentStyles:o,currentVelocities:e.currentVelocities})}},render:function(){var e=this.state.currentStyles.map(P.default),n=this.props.children(e);return n&&t.Children.only(n)}}),a=t.createClass({displayName:"TransitionMotion",propTypes:{defaultValue:function(t,e){return t[e]?new Error("TransitionSpring's `defaultValue` has been changed to `defaultStyles`. Its format received a few (easy to update!) changes as well."):void 0},endValue:function(t,e){return t[e]?new Error("TransitionSpring's `endValue` has been changed to `styles`. Its format received a few (easy to update!) changes as well."):void 0},defaultStyle:function(t,e){return t[e]?new Error('You forgot the "s" for `TransitionMotion`\'s `defaultStyles`.'):void 0},style:function(t,e){return t[e]?new Error('You forgot the "s" for `TransitionMotion`\'s `styles`.'):void 0},defaultStyles:e.objectOf(e.any),styles:e.oneOfType([e.func,e.objectOf(e.any.isRequired)]).isRequired,willLeave:e.oneOfType([e.func]),willEnter:e.oneOfType([e.func]),children:e.func.isRequired},getDefaultProps:function(){return{willEnter:function(t,e){return e},willLeave:function(){return null}}},getInitialState:function(){var t=this.props,e=t.styles,n=t.defaultStyles,o=void 0;return o=null==n?"function"==typeof e?e():e:n,{currentStyles:o,currentVelocities:r(function(t){return r(m.default,t)},o)}},componentDidMount:function(){this.startAnimating()},componentWillReceiveProps:function(){this.startAnimating()},animationStep:function(t,e){var n=e.currentStyles,o=e.currentVelocities,a=this.props,l=a.styles,c=a.willEnter,p=a.willLeave;"function"==typeof l&&(l=l(n));var h=l,v=!1;h=d.default(n,l,function(t){var e=p(t,n[t],l,n,o);return null==e?null:u.default(o[t],n[t])&&f.default(n[t],e)?null:e}),Object.keys(h).filter(function(t){return!n.hasOwnProperty(t)}).forEach(function(t){var e,i;v=!0;var a=c(t,h[t],l,n,o);h[t]=a,n=s({},n,(e={},e[t]=a,e)),o=s({},o,(i={},i[t]=r(m.default,a),i))});var y=r(function(e,r){return g.updateCurrentStyle(t,n[r],o[r],e)},h),S=r(function(e,r){return g.updateCurrentVelocity(t,n[r],o[r],e)},h);return!v&&i(function(t,e){return u.default(t,n[e])},o)&&i(function(t,e){return u.default(t,y[e])},S)&&this.stopAnimation(),{currentStyles:y,currentVelocities:S}},stopAnimation:null,hasUnmounted:!1,componentWillUnmount:function(){this.stopAnimation(),this.hasUnmounted=!0},startAnimating:function(){this.stopAnimation=M(this.state,this.animationStep,this.animationRender)},animationRender:function(t,e,n){if(!this.hasUnmounted){var o=r(function(e,o){return g.interpolateValue(t,e,n.currentStyles[o])},e.currentStyles);this.setState({currentStyles:o,currentVelocities:e.currentVelocities})}},render:function(){var e=r(P.default,this.state.currentStyles),n=this.props.children(e);return n&&t.Children.only(n)}}),l=b.default(t),c=l.Spring,p=l.TransitionSpring;return{Spring:c,TransitionSpring:p,Motion:n,StaggeredMotion:o,TransitionMotion:a}}e.__esModule=!0;var s=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(t[o]=n[o])}return t};e.default=a;var l=n(54),u=o(l),c=n(52),f=o(c),p=n(53),d=o(p),h=n(49),v=o(h),y=n(59),m=o(y),g=n(58),S=n(51),b=o(S),w=n(57),P=o(w),M=v.default();t.exports=e.default},function(t,e,n){"use strict";function o(t){var e=t.createClass({displayName:"Spring",componentWillMount:function(){},render:function(){return null}}),n=t.createClass({displayName:"TransitionSpring",componentWillMount:function(){},render:function(){return null}});return{Spring:e,TransitionSpring:n}}e.__esModule=!0,e.default=o;t.exports=e.default},function(t,e){"use strict";function n(t,e){for(var n in e)if(e.hasOwnProperty(n)){var o=t[n],r=e[n];if(null!=r&&r.config){if(o.config&&o.val!==r.val)return!1;if(!o.config&&o!==r.val)return!1}}return!0}e.__esModule=!0,e.default=n,t.exports=e.default},function(t,e){"use strict";function n(t,e,n,o,r,i,a){for(var s=!0;s;){var l=t,u=e,c=n,f=o,p=r,d=i,h=a;v=y=m=g=S=S=void 0,s=!1;var v=f===l.length,y=p===u.length,m=l[f],g=u[p];if(v&&y)return null;if(v)h[g]=c[g],t=l,e=u,n=c,o=f,r=p+1,i=d,a=h,s=!0;else if(y){var S=d(m);null!=S&&(h[m]=S),t=l,e=u,n=c,o=f+1,r=p,i=d,a=h,s=!0}else if(m!==g)if(c.hasOwnProperty(m))t=l,e=u,n=c,o=f+1,r=p,i=d,a=h,s=!0;else{var S=d(m);null!=S&&(h[m]=S),t=l,e=u,n=c,o=f+1,r=p,i=d,a=h,s=!0}else h[m]=c[m],t=l,e=u,n=c,o=f+1,r=p+1,i=d,a=h,s=!0}}function o(t,e,o){var r={};return n(Object.keys(t),Object.keys(e),e,0,0,o,r),r}e.__esModule=!0,e.default=o,t.exports=e.default},function(t,e){"use strict";function n(t,e){for(var n in t)if(t.hasOwnProperty(n)&&null!=e[n]&&e[n].config&&0!==t[n])return!1;return!0}e.__esModule=!0,e.default=n,t.exports=e.default},function(t,e){"use strict";function n(t,e){for(var n=e(Object.keys(t)),o={},r=0;r<n.length;r++){var i=n[r];o[i]=t[i]}return o}e.__esModule=!0,e.default=n,t.exports=e.default},function(t,e){"use strict";function n(t,e,n,r,i,a){var s=-i*(e-r),l=-a*n,u=s+l,c=n+u*t,f=e+c*t;return Math.abs(c-n)<o&&Math.abs(f-e)<o?[r,0]:[f,c];
}e.__esModule=!0,e.default=n;var o=1e-4;t.exports=e.default},function(t,e){"use strict";function n(t){var e={};for(var n in t)t.hasOwnProperty(n)&&(e[n]=null==t[n]||null==t[n].val?t[n]:t[n].val);return e}e.__esModule=!0,e.default=n,t.exports=e.default},function(t,e,n){"use strict";function o(t){return t&&t.__esModule?t:{"default":t}}function r(t,e,n){if(!n)return e;var o={};for(var r in e)if(e.hasOwnProperty(r))if(null!=e[r]&&e[r].config){var i=n[r].config?n[r].val:n[r];o[r]=c.default(e[r].val*t+i*(1-t),e[r].config)}else o[r]=e[r];return o}function i(t,e,n,o){var r={};for(var i in o)if(o.hasOwnProperty(i))if(null!=o[i]&&o[i].config){var a=o[i].config,s=a[0],u=a[1],f=l.default(t,null==e[i].val?e[i]:e[i].val,n[i],o[i].val,s,u)[0];r[i]=c.default(f,o[i].config)}else r[i]=o[i];return r}function a(t,e,n,o){var r={};for(var i in o)if(o.hasOwnProperty(i))if(null!=o[i]&&o[i].config){var a=o[i].config,s=a[0],u=a[1],c=l.default(t,null==e[i].val?e[i]:e[i].val,n[i],o[i].val,s,u)[1];r[i]=c}else r[i]=0;return r}e.__esModule=!0,e.interpolateValue=r,e.updateCurrentStyle=i,e.updateCurrentVelocity=a;var s=n(56),l=o(s),u=n(18),c=o(u)},function(t,e){"use strict";function n(){return 0}e.__esModule=!0,e.default=n,t.exports=e.default},function(t,e,n){for(var o=n(19),r="undefined"==typeof window?{}:window,i=["moz","webkit"],a="AnimationFrame",s=r["request"+a],l=r["cancel"+a]||r["cancelRequest"+a],u=0;u<i.length&&!s;u++)s=r[i[u]+"Request"+a],l=r[i[u]+"Cancel"+a]||r[i[u]+"CancelRequest"+a];if(!s||!l){var c=0,f=0,p=[],d=1e3/60;s=function(t){if(0===p.length){var e=o(),n=Math.max(0,d-(e-c));c=n+e,setTimeout(function(){var t=p.slice(0);p.length=0;for(var e=0;e<t.length;e++)if(!t[e].cancelled)try{t[e].callback(c)}catch(n){setTimeout(function(){throw n},0)}},Math.round(n))}return p.push({handle:++f,callback:t,cancelled:!1}),f},l=function(t){for(var e=0;e<p.length;e++)p[e].handle===t&&(p[e].cancelled=!0)}}t.exports=function(t){return s.call(r,t)},t.exports.cancel=function(){l.apply(r,arguments)}},function(t,e){function n(){u=!1,a.length?l=a.concat(l):c=-1,l.length&&o()}function o(){if(!u){var t=setTimeout(n);u=!0;for(var e=l.length;e;){for(a=l,l=[];++c<e;)a&&a[c].run();c=-1,e=l.length}a=null,u=!1,clearTimeout(t)}}function r(t,e){this.fun=t,this.array=e}function i(){}var a,s=t.exports={},l=[],u=!1,c=-1;s.nextTick=function(t){var e=new Array(arguments.length-1);if(arguments.length>1)for(var n=1;n<arguments.length;n++)e[n-1]=arguments[n];l.push(new r(t,e)),1!==l.length||u||setTimeout(o,0)},r.prototype.run=function(){this.fun.apply(null,this.array)},s.title="browser",s.browser=!0,s.env={},s.argv=[],s.version="",s.versions={},s.on=i,s.addListener=i,s.once=i,s.off=i,s.removeListener=i,s.removeAllListeners=i,s.emit=i,s.binding=function(t){throw new Error("process.binding is not supported")},s.cwd=function(){return"/"},s.chdir=function(t){throw new Error("process.chdir is not supported")},s.umask=function(){return 0}}])});
},{"react":212}],57:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule AutoFocusUtils
 * @typechecks static-only
 */

'use strict';

var ReactMount = require('./ReactMount');

var findDOMNode = require('./findDOMNode');
var focusNode = require('fbjs/lib/focusNode');

var Mixin = {
  componentDidMount: function () {
    if (this.props.autoFocus) {
      focusNode(findDOMNode(this));
    }
  }
};

var AutoFocusUtils = {
  Mixin: Mixin,

  focusDOMComponent: function () {
    focusNode(ReactMount.getNode(this._rootNodeID));
  }
};

module.exports = AutoFocusUtils;
},{"./ReactMount":121,"./findDOMNode":164,"fbjs/lib/focusNode":194}],58:[function(require,module,exports){
/**
 * Copyright 2013-2015 Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule BeforeInputEventPlugin
 * @typechecks static-only
 */

'use strict';

var EventConstants = require('./EventConstants');
var EventPropagators = require('./EventPropagators');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');
var FallbackCompositionState = require('./FallbackCompositionState');
var SyntheticCompositionEvent = require('./SyntheticCompositionEvent');
var SyntheticInputEvent = require('./SyntheticInputEvent');

var keyOf = require('fbjs/lib/keyOf');

var END_KEYCODES = [9, 13, 27, 32]; // Tab, Return, Esc, Space
var START_KEYCODE = 229;

var canUseCompositionEvent = ExecutionEnvironment.canUseDOM && 'CompositionEvent' in window;

var documentMode = null;
if (ExecutionEnvironment.canUseDOM && 'documentMode' in document) {
  documentMode = document.documentMode;
}

// Webkit offers a very useful `textInput` event that can be used to
// directly represent `beforeInput`. The IE `textinput` event is not as
// useful, so we don't use it.
var canUseTextInputEvent = ExecutionEnvironment.canUseDOM && 'TextEvent' in window && !documentMode && !isPresto();

// In IE9+, we have access to composition events, but the data supplied
// by the native compositionend event may be incorrect. Japanese ideographic
// spaces, for instance (\u3000) are not recorded correctly.
var useFallbackCompositionData = ExecutionEnvironment.canUseDOM && (!canUseCompositionEvent || documentMode && documentMode > 8 && documentMode <= 11);

/**
 * Opera <= 12 includes TextEvent in window, but does not fire
 * text input events. Rely on keypress instead.
 */
function isPresto() {
  var opera = window.opera;
  return typeof opera === 'object' && typeof opera.version === 'function' && parseInt(opera.version(), 10) <= 12;
}

var SPACEBAR_CODE = 32;
var SPACEBAR_CHAR = String.fromCharCode(SPACEBAR_CODE);

var topLevelTypes = EventConstants.topLevelTypes;

// Events and their corresponding property names.
var eventTypes = {
  beforeInput: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onBeforeInput: null }),
      captured: keyOf({ onBeforeInputCapture: null })
    },
    dependencies: [topLevelTypes.topCompositionEnd, topLevelTypes.topKeyPress, topLevelTypes.topTextInput, topLevelTypes.topPaste]
  },
  compositionEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onCompositionEnd: null }),
      captured: keyOf({ onCompositionEndCapture: null })
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionEnd, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]
  },
  compositionStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onCompositionStart: null }),
      captured: keyOf({ onCompositionStartCapture: null })
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionStart, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]
  },
  compositionUpdate: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onCompositionUpdate: null }),
      captured: keyOf({ onCompositionUpdateCapture: null })
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionUpdate, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]
  }
};

// Track whether we've ever handled a keypress on the space key.
var hasSpaceKeypress = false;

/**
 * Return whether a native keypress event is assumed to be a command.
 * This is required because Firefox fires `keypress` events for key commands
 * (cut, copy, select-all, etc.) even though no character is inserted.
 */
function isKeypressCommand(nativeEvent) {
  return (nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) &&
  // ctrlKey && altKey is equivalent to AltGr, and is not a command.
  !(nativeEvent.ctrlKey && nativeEvent.altKey);
}

/**
 * Translate native top level events into event types.
 *
 * @param {string} topLevelType
 * @return {object}
 */
function getCompositionEventType(topLevelType) {
  switch (topLevelType) {
    case topLevelTypes.topCompositionStart:
      return eventTypes.compositionStart;
    case topLevelTypes.topCompositionEnd:
      return eventTypes.compositionEnd;
    case topLevelTypes.topCompositionUpdate:
      return eventTypes.compositionUpdate;
  }
}

/**
 * Does our fallback best-guess model think this event signifies that
 * composition has begun?
 *
 * @param {string} topLevelType
 * @param {object} nativeEvent
 * @return {boolean}
 */
function isFallbackCompositionStart(topLevelType, nativeEvent) {
  return topLevelType === topLevelTypes.topKeyDown && nativeEvent.keyCode === START_KEYCODE;
}

/**
 * Does our fallback mode think that this event is the end of composition?
 *
 * @param {string} topLevelType
 * @param {object} nativeEvent
 * @return {boolean}
 */
function isFallbackCompositionEnd(topLevelType, nativeEvent) {
  switch (topLevelType) {
    case topLevelTypes.topKeyUp:
      // Command keys insert or clear IME input.
      return END_KEYCODES.indexOf(nativeEvent.keyCode) !== -1;
    case topLevelTypes.topKeyDown:
      // Expect IME keyCode on each keydown. If we get any other
      // code we must have exited earlier.
      return nativeEvent.keyCode !== START_KEYCODE;
    case topLevelTypes.topKeyPress:
    case topLevelTypes.topMouseDown:
    case topLevelTypes.topBlur:
      // Events are not possible without cancelling IME.
      return true;
    default:
      return false;
  }
}

/**
 * Google Input Tools provides composition data via a CustomEvent,
 * with the `data` property populated in the `detail` object. If this
 * is available on the event object, use it. If not, this is a plain
 * composition event and we have nothing special to extract.
 *
 * @param {object} nativeEvent
 * @return {?string}
 */
function getDataFromCustomEvent(nativeEvent) {
  var detail = nativeEvent.detail;
  if (typeof detail === 'object' && 'data' in detail) {
    return detail.data;
  }
  return null;
}

// Track the current IME composition fallback object, if any.
var currentComposition = null;

/**
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {DOMEventTarget} topLevelTarget The listening component root node.
 * @param {string} topLevelTargetID ID of `topLevelTarget`.
 * @param {object} nativeEvent Native browser event.
 * @return {?object} A SyntheticCompositionEvent.
 */
function extractCompositionEvent(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
  var eventType;
  var fallbackData;

  if (canUseCompositionEvent) {
    eventType = getCompositionEventType(topLevelType);
  } else if (!currentComposition) {
    if (isFallbackCompositionStart(topLevelType, nativeEvent)) {
      eventType = eventTypes.compositionStart;
    }
  } else if (isFallbackCompositionEnd(topLevelType, nativeEvent)) {
    eventType = eventTypes.compositionEnd;
  }

  if (!eventType) {
    return null;
  }

  if (useFallbackCompositionData) {
    // The current composition is stored statically and must not be
    // overwritten while composition continues.
    if (!currentComposition && eventType === eventTypes.compositionStart) {
      currentComposition = FallbackCompositionState.getPooled(topLevelTarget);
    } else if (eventType === eventTypes.compositionEnd) {
      if (currentComposition) {
        fallbackData = currentComposition.getData();
      }
    }
  }

  var event = SyntheticCompositionEvent.getPooled(eventType, topLevelTargetID, nativeEvent, nativeEventTarget);

  if (fallbackData) {
    // Inject data generated from fallback path into the synthetic event.
    // This matches the property of native CompositionEventInterface.
    event.data = fallbackData;
  } else {
    var customData = getDataFromCustomEvent(nativeEvent);
    if (customData !== null) {
      event.data = customData;
    }
  }

  EventPropagators.accumulateTwoPhaseDispatches(event);
  return event;
}

/**
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {object} nativeEvent Native browser event.
 * @return {?string} The string corresponding to this `beforeInput` event.
 */
function getNativeBeforeInputChars(topLevelType, nativeEvent) {
  switch (topLevelType) {
    case topLevelTypes.topCompositionEnd:
      return getDataFromCustomEvent(nativeEvent);
    case topLevelTypes.topKeyPress:
      /**
       * If native `textInput` events are available, our goal is to make
       * use of them. However, there is a special case: the spacebar key.
       * In Webkit, preventing default on a spacebar `textInput` event
       * cancels character insertion, but it *also* causes the browser
       * to fall back to its default spacebar behavior of scrolling the
       * page.
       *
       * Tracking at:
       * https://code.google.com/p/chromium/issues/detail?id=355103
       *
       * To avoid this issue, use the keypress event as if no `textInput`
       * event is available.
       */
      var which = nativeEvent.which;
      if (which !== SPACEBAR_CODE) {
        return null;
      }

      hasSpaceKeypress = true;
      return SPACEBAR_CHAR;

    case topLevelTypes.topTextInput:
      // Record the characters to be added to the DOM.
      var chars = nativeEvent.data;

      // If it's a spacebar character, assume that we have already handled
      // it at the keypress level and bail immediately. Android Chrome
      // doesn't give us keycodes, so we need to blacklist it.
      if (chars === SPACEBAR_CHAR && hasSpaceKeypress) {
        return null;
      }

      return chars;

    default:
      // For other native event types, do nothing.
      return null;
  }
}

/**
 * For browsers that do not provide the `textInput` event, extract the
 * appropriate string to use for SyntheticInputEvent.
 *
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {object} nativeEvent Native browser event.
 * @return {?string} The fallback string for this `beforeInput` event.
 */
function getFallbackBeforeInputChars(topLevelType, nativeEvent) {
  // If we are currently composing (IME) and using a fallback to do so,
  // try to extract the composed characters from the fallback object.
  if (currentComposition) {
    if (topLevelType === topLevelTypes.topCompositionEnd || isFallbackCompositionEnd(topLevelType, nativeEvent)) {
      var chars = currentComposition.getData();
      FallbackCompositionState.release(currentComposition);
      currentComposition = null;
      return chars;
    }
    return null;
  }

  switch (topLevelType) {
    case topLevelTypes.topPaste:
      // If a paste event occurs after a keypress, throw out the input
      // chars. Paste events should not lead to BeforeInput events.
      return null;
    case topLevelTypes.topKeyPress:
      /**
       * As of v27, Firefox may fire keypress events even when no character
       * will be inserted. A few possibilities:
       *
       * - `which` is `0`. Arrow keys, Esc key, etc.
       *
       * - `which` is the pressed key code, but no char is available.
       *   Ex: 'AltGr + d` in Polish. There is no modified character for
       *   this key combination and no character is inserted into the
       *   document, but FF fires the keypress for char code `100` anyway.
       *   No `input` event will occur.
       *
       * - `which` is the pressed key code, but a command combination is
       *   being used. Ex: `Cmd+C`. No character is inserted, and no
       *   `input` event will occur.
       */
      if (nativeEvent.which && !isKeypressCommand(nativeEvent)) {
        return String.fromCharCode(nativeEvent.which);
      }
      return null;
    case topLevelTypes.topCompositionEnd:
      return useFallbackCompositionData ? null : nativeEvent.data;
    default:
      return null;
  }
}

/**
 * Extract a SyntheticInputEvent for `beforeInput`, based on either native
 * `textInput` or fallback behavior.
 *
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {DOMEventTarget} topLevelTarget The listening component root node.
 * @param {string} topLevelTargetID ID of `topLevelTarget`.
 * @param {object} nativeEvent Native browser event.
 * @return {?object} A SyntheticInputEvent.
 */
function extractBeforeInputEvent(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
  var chars;

  if (canUseTextInputEvent) {
    chars = getNativeBeforeInputChars(topLevelType, nativeEvent);
  } else {
    chars = getFallbackBeforeInputChars(topLevelType, nativeEvent);
  }

  // If no characters are being inserted, no BeforeInput event should
  // be fired.
  if (!chars) {
    return null;
  }

  var event = SyntheticInputEvent.getPooled(eventTypes.beforeInput, topLevelTargetID, nativeEvent, nativeEventTarget);

  event.data = chars;
  EventPropagators.accumulateTwoPhaseDispatches(event);
  return event;
}

/**
 * Create an `onBeforeInput` event to match
 * http://www.w3.org/TR/2013/WD-DOM-Level-3-Events-20131105/#events-inputevents.
 *
 * This event plugin is based on the native `textInput` event
 * available in Chrome, Safari, Opera, and IE. This event fires after
 * `onKeyPress` and `onCompositionEnd`, but before `onInput`.
 *
 * `beforeInput` is spec'd but not implemented in any browsers, and
 * the `input` event does not provide any useful information about what has
 * actually been added, contrary to the spec. Thus, `textInput` is the best
 * available event to identify the characters that have actually been inserted
 * into the target node.
 *
 * This plugin is also responsible for emitting `composition` events, thus
 * allowing us to share composition fallback code for both `beforeInput` and
 * `composition` event types.
 */
var BeforeInputEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function (topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
    return [extractCompositionEvent(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget), extractBeforeInputEvent(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget)];
  }
};

module.exports = BeforeInputEventPlugin;
},{"./EventConstants":70,"./EventPropagators":74,"./FallbackCompositionState":75,"./SyntheticCompositionEvent":146,"./SyntheticInputEvent":150,"fbjs/lib/ExecutionEnvironment":186,"fbjs/lib/keyOf":204}],59:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CSSProperty
 */

'use strict';

/**
 * CSS properties which accept numbers but are not in units of "px".
 */
var isUnitlessNumber = {
  animationIterationCount: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  flexOrder: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,

  // SVG-related properties
  fillOpacity: true,
  stopOpacity: true,
  strokeDashoffset: true,
  strokeOpacity: true,
  strokeWidth: true
};

/**
 * @param {string} prefix vendor-specific prefix, eg: Webkit
 * @param {string} key style name, eg: transitionDuration
 * @return {string} style name prefixed with `prefix`, properly camelCased, eg:
 * WebkitTransitionDuration
 */
function prefixKey(prefix, key) {
  return prefix + key.charAt(0).toUpperCase() + key.substring(1);
}

/**
 * Support style names that may come passed in prefixed by adding permutations
 * of vendor prefixes.
 */
var prefixes = ['Webkit', 'ms', 'Moz', 'O'];

// Using Object.keys here, or else the vanilla for-in loop makes IE8 go into an
// infinite loop, because it iterates over the newly added props too.
Object.keys(isUnitlessNumber).forEach(function (prop) {
  prefixes.forEach(function (prefix) {
    isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
  });
});

/**
 * Most style properties can be unset by doing .style[prop] = '' but IE8
 * doesn't like doing that with shorthand properties so for the properties that
 * IE8 breaks on, which are listed here, we instead unset each of the
 * individual properties. See http://bugs.jquery.com/ticket/12385.
 * The 4-value 'clock' properties like margin, padding, border-width seem to
 * behave without any problems. Curiously, list-style works too without any
 * special prodding.
 */
var shorthandPropertyExpansions = {
  background: {
    backgroundAttachment: true,
    backgroundColor: true,
    backgroundImage: true,
    backgroundPositionX: true,
    backgroundPositionY: true,
    backgroundRepeat: true
  },
  backgroundPosition: {
    backgroundPositionX: true,
    backgroundPositionY: true
  },
  border: {
    borderWidth: true,
    borderStyle: true,
    borderColor: true
  },
  borderBottom: {
    borderBottomWidth: true,
    borderBottomStyle: true,
    borderBottomColor: true
  },
  borderLeft: {
    borderLeftWidth: true,
    borderLeftStyle: true,
    borderLeftColor: true
  },
  borderRight: {
    borderRightWidth: true,
    borderRightStyle: true,
    borderRightColor: true
  },
  borderTop: {
    borderTopWidth: true,
    borderTopStyle: true,
    borderTopColor: true
  },
  font: {
    fontStyle: true,
    fontVariant: true,
    fontWeight: true,
    fontSize: true,
    lineHeight: true,
    fontFamily: true
  },
  outline: {
    outlineWidth: true,
    outlineStyle: true,
    outlineColor: true
  }
};

var CSSProperty = {
  isUnitlessNumber: isUnitlessNumber,
  shorthandPropertyExpansions: shorthandPropertyExpansions
};

module.exports = CSSProperty;
},{}],60:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CSSPropertyOperations
 * @typechecks static-only
 */

'use strict';

var CSSProperty = require('./CSSProperty');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');
var ReactPerf = require('./ReactPerf');

var camelizeStyleName = require('fbjs/lib/camelizeStyleName');
var dangerousStyleValue = require('./dangerousStyleValue');
var hyphenateStyleName = require('fbjs/lib/hyphenateStyleName');
var memoizeStringOnly = require('fbjs/lib/memoizeStringOnly');
var warning = require('fbjs/lib/warning');

var processStyleName = memoizeStringOnly(function (styleName) {
  return hyphenateStyleName(styleName);
});

var hasShorthandPropertyBug = false;
var styleFloatAccessor = 'cssFloat';
if (ExecutionEnvironment.canUseDOM) {
  var tempStyle = document.createElement('div').style;
  try {
    // IE8 throws "Invalid argument." if resetting shorthand style properties.
    tempStyle.font = '';
  } catch (e) {
    hasShorthandPropertyBug = true;
  }
  // IE8 only supports accessing cssFloat (standard) as styleFloat
  if (document.documentElement.style.cssFloat === undefined) {
    styleFloatAccessor = 'styleFloat';
  }
}

if ("production" !== 'production') {
  // 'msTransform' is correct, but the other prefixes should be capitalized
  var badVendoredStyleNamePattern = /^(?:webkit|moz|o)[A-Z]/;

  // style values shouldn't contain a semicolon
  var badStyleValueWithSemicolonPattern = /;\s*$/;

  var warnedStyleNames = {};
  var warnedStyleValues = {};

  var warnHyphenatedStyleName = function (name) {
    if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
      return;
    }

    warnedStyleNames[name] = true;
    "production" !== 'production' ? warning(false, 'Unsupported style property %s. Did you mean %s?', name, camelizeStyleName(name)) : undefined;
  };

  var warnBadVendoredStyleName = function (name) {
    if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
      return;
    }

    warnedStyleNames[name] = true;
    "production" !== 'production' ? warning(false, 'Unsupported vendor-prefixed style property %s. Did you mean %s?', name, name.charAt(0).toUpperCase() + name.slice(1)) : undefined;
  };

  var warnStyleValueWithSemicolon = function (name, value) {
    if (warnedStyleValues.hasOwnProperty(value) && warnedStyleValues[value]) {
      return;
    }

    warnedStyleValues[value] = true;
    "production" !== 'production' ? warning(false, 'Style property values shouldn\'t contain a semicolon. ' + 'Try "%s: %s" instead.', name, value.replace(badStyleValueWithSemicolonPattern, '')) : undefined;
  };

  /**
   * @param {string} name
   * @param {*} value
   */
  var warnValidStyle = function (name, value) {
    if (name.indexOf('-') > -1) {
      warnHyphenatedStyleName(name);
    } else if (badVendoredStyleNamePattern.test(name)) {
      warnBadVendoredStyleName(name);
    } else if (badStyleValueWithSemicolonPattern.test(value)) {
      warnStyleValueWithSemicolon(name, value);
    }
  };
}

/**
 * Operations for dealing with CSS properties.
 */
var CSSPropertyOperations = {

  /**
   * Serializes a mapping of style properties for use as inline styles:
   *
   *   > createMarkupForStyles({width: '200px', height: 0})
   *   "width:200px;height:0;"
   *
   * Undefined values are ignored so that declarative programming is easier.
   * The result should be HTML-escaped before insertion into the DOM.
   *
   * @param {object} styles
   * @return {?string}
   */
  createMarkupForStyles: function (styles) {
    var serialized = '';
    for (var styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      var styleValue = styles[styleName];
      if ("production" !== 'production') {
        warnValidStyle(styleName, styleValue);
      }
      if (styleValue != null) {
        serialized += processStyleName(styleName) + ':';
        serialized += dangerousStyleValue(styleName, styleValue) + ';';
      }
    }
    return serialized || null;
  },

  /**
   * Sets the value for multiple styles on a node.  If a value is specified as
   * '' (empty string), the corresponding style property will be unset.
   *
   * @param {DOMElement} node
   * @param {object} styles
   */
  setValueForStyles: function (node, styles) {
    var style = node.style;
    for (var styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      if ("production" !== 'production') {
        warnValidStyle(styleName, styles[styleName]);
      }
      var styleValue = dangerousStyleValue(styleName, styles[styleName]);
      if (styleName === 'float') {
        styleName = styleFloatAccessor;
      }
      if (styleValue) {
        style[styleName] = styleValue;
      } else {
        var expansion = hasShorthandPropertyBug && CSSProperty.shorthandPropertyExpansions[styleName];
        if (expansion) {
          // Shorthand property that IE8 won't like unsetting, so unset each
          // component to placate it
          for (var individualStyleName in expansion) {
            style[individualStyleName] = '';
          }
        } else {
          style[styleName] = '';
        }
      }
    }
  }

};

ReactPerf.measureMethods(CSSPropertyOperations, 'CSSPropertyOperations', {
  setValueForStyles: 'setValueForStyles'
});

module.exports = CSSPropertyOperations;
},{"./CSSProperty":59,"./ReactPerf":127,"./dangerousStyleValue":161,"fbjs/lib/ExecutionEnvironment":186,"fbjs/lib/camelizeStyleName":188,"fbjs/lib/hyphenateStyleName":199,"fbjs/lib/memoizeStringOnly":206,"fbjs/lib/warning":211}],61:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CallbackQueue
 */

'use strict';

var PooledClass = require('./PooledClass');

var assign = require('./Object.assign');
var invariant = require('fbjs/lib/invariant');

/**
 * A specialized pseudo-event module to help keep track of components waiting to
 * be notified when their DOM representations are available for use.
 *
 * This implements `PooledClass`, so you should never need to instantiate this.
 * Instead, use `CallbackQueue.getPooled()`.
 *
 * @class ReactMountReady
 * @implements PooledClass
 * @internal
 */
function CallbackQueue() {
  this._callbacks = null;
  this._contexts = null;
}

assign(CallbackQueue.prototype, {

  /**
   * Enqueues a callback to be invoked when `notifyAll` is invoked.
   *
   * @param {function} callback Invoked when `notifyAll` is invoked.
   * @param {?object} context Context to call `callback` with.
   * @internal
   */
  enqueue: function (callback, context) {
    this._callbacks = this._callbacks || [];
    this._contexts = this._contexts || [];
    this._callbacks.push(callback);
    this._contexts.push(context);
  },

  /**
   * Invokes all enqueued callbacks and clears the queue. This is invoked after
   * the DOM representation of a component has been created or updated.
   *
   * @internal
   */
  notifyAll: function () {
    var callbacks = this._callbacks;
    var contexts = this._contexts;
    if (callbacks) {
      !(callbacks.length === contexts.length) ? "production" !== 'production' ? invariant(false, 'Mismatched list of contexts in callback queue') : invariant(false) : undefined;
      this._callbacks = null;
      this._contexts = null;
      for (var i = 0; i < callbacks.length; i++) {
        callbacks[i].call(contexts[i]);
      }
      callbacks.length = 0;
      contexts.length = 0;
    }
  },

  /**
   * Resets the internal queue.
   *
   * @internal
   */
  reset: function () {
    this._callbacks = null;
    this._contexts = null;
  },

  /**
   * `PooledClass` looks for this.
   */
  destructor: function () {
    this.reset();
  }

});

PooledClass.addPoolingTo(CallbackQueue);

module.exports = CallbackQueue;
},{"./Object.assign":78,"./PooledClass":79,"fbjs/lib/invariant":200}],62:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ChangeEventPlugin
 */

'use strict';

var EventConstants = require('./EventConstants');
var EventPluginHub = require('./EventPluginHub');
var EventPropagators = require('./EventPropagators');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');
var ReactUpdates = require('./ReactUpdates');
var SyntheticEvent = require('./SyntheticEvent');

var getEventTarget = require('./getEventTarget');
var isEventSupported = require('./isEventSupported');
var isTextInputElement = require('./isTextInputElement');
var keyOf = require('fbjs/lib/keyOf');

var topLevelTypes = EventConstants.topLevelTypes;

var eventTypes = {
  change: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onChange: null }),
      captured: keyOf({ onChangeCapture: null })
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topChange, topLevelTypes.topClick, topLevelTypes.topFocus, topLevelTypes.topInput, topLevelTypes.topKeyDown, topLevelTypes.topKeyUp, topLevelTypes.topSelectionChange]
  }
};

/**
 * For IE shims
 */
var activeElement = null;
var activeElementID = null;
var activeElementValue = null;
var activeElementValueProp = null;

/**
 * SECTION: handle `change` event
 */
function shouldUseChangeEvent(elem) {
  var nodeName = elem.nodeName && elem.nodeName.toLowerCase();
  return nodeName === 'select' || nodeName === 'input' && elem.type === 'file';
}

var doesChangeEventBubble = false;
if (ExecutionEnvironment.canUseDOM) {
  // See `handleChange` comment below
  doesChangeEventBubble = isEventSupported('change') && (!('documentMode' in document) || document.documentMode > 8);
}

function manualDispatchChangeEvent(nativeEvent) {
  var event = SyntheticEvent.getPooled(eventTypes.change, activeElementID, nativeEvent, getEventTarget(nativeEvent));
  EventPropagators.accumulateTwoPhaseDispatches(event);

  // If change and propertychange bubbled, we'd just bind to it like all the
  // other events and have it go through ReactBrowserEventEmitter. Since it
  // doesn't, we manually listen for the events and so we have to enqueue and
  // process the abstract event manually.
  //
  // Batching is necessary here in order to ensure that all event handlers run
  // before the next rerender (including event handlers attached to ancestor
  // elements instead of directly on the input). Without this, controlled
  // components don't work properly in conjunction with event bubbling because
  // the component is rerendered and the value reverted before all the event
  // handlers can run. See https://github.com/facebook/react/issues/708.
  ReactUpdates.batchedUpdates(runEventInBatch, event);
}

function runEventInBatch(event) {
  EventPluginHub.enqueueEvents(event);
  EventPluginHub.processEventQueue(false);
}

function startWatchingForChangeEventIE8(target, targetID) {
  activeElement = target;
  activeElementID = targetID;
  activeElement.attachEvent('onchange', manualDispatchChangeEvent);
}

function stopWatchingForChangeEventIE8() {
  if (!activeElement) {
    return;
  }
  activeElement.detachEvent('onchange', manualDispatchChangeEvent);
  activeElement = null;
  activeElementID = null;
}

function getTargetIDForChangeEvent(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topChange) {
    return topLevelTargetID;
  }
}
function handleEventsForChangeEventIE8(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topFocus) {
    // stopWatching() should be a noop here but we call it just in case we
    // missed a blur event somehow.
    stopWatchingForChangeEventIE8();
    startWatchingForChangeEventIE8(topLevelTarget, topLevelTargetID);
  } else if (topLevelType === topLevelTypes.topBlur) {
    stopWatchingForChangeEventIE8();
  }
}

/**
 * SECTION: handle `input` event
 */
var isInputEventSupported = false;
if (ExecutionEnvironment.canUseDOM) {
  // IE9 claims to support the input event but fails to trigger it when
  // deleting text, so we ignore its input events
  isInputEventSupported = isEventSupported('input') && (!('documentMode' in document) || document.documentMode > 9);
}

/**
 * (For old IE.) Replacement getter/setter for the `value` property that gets
 * set on the active element.
 */
var newValueProp = {
  get: function () {
    return activeElementValueProp.get.call(this);
  },
  set: function (val) {
    // Cast to a string so we can do equality checks.
    activeElementValue = '' + val;
    activeElementValueProp.set.call(this, val);
  }
};

/**
 * (For old IE.) Starts tracking propertychange events on the passed-in element
 * and override the value property so that we can distinguish user events from
 * value changes in JS.
 */
function startWatchingForValueChange(target, targetID) {
  activeElement = target;
  activeElementID = targetID;
  activeElementValue = target.value;
  activeElementValueProp = Object.getOwnPropertyDescriptor(target.constructor.prototype, 'value');

  // Not guarded in a canDefineProperty check: IE8 supports defineProperty only
  // on DOM elements
  Object.defineProperty(activeElement, 'value', newValueProp);
  activeElement.attachEvent('onpropertychange', handlePropertyChange);
}

/**
 * (For old IE.) Removes the event listeners from the currently-tracked element,
 * if any exists.
 */
function stopWatchingForValueChange() {
  if (!activeElement) {
    return;
  }

  // delete restores the original property definition
  delete activeElement.value;
  activeElement.detachEvent('onpropertychange', handlePropertyChange);

  activeElement = null;
  activeElementID = null;
  activeElementValue = null;
  activeElementValueProp = null;
}

/**
 * (For old IE.) Handles a propertychange event, sending a `change` event if
 * the value of the active element has changed.
 */
function handlePropertyChange(nativeEvent) {
  if (nativeEvent.propertyName !== 'value') {
    return;
  }
  var value = nativeEvent.srcElement.value;
  if (value === activeElementValue) {
    return;
  }
  activeElementValue = value;

  manualDispatchChangeEvent(nativeEvent);
}

/**
 * If a `change` event should be fired, returns the target's ID.
 */
function getTargetIDForInputEvent(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topInput) {
    // In modern browsers (i.e., not IE8 or IE9), the input event is exactly
    // what we want so fall through here and trigger an abstract event
    return topLevelTargetID;
  }
}

// For IE8 and IE9.
function handleEventsForInputEventIE(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topFocus) {
    // In IE8, we can capture almost all .value changes by adding a
    // propertychange handler and looking for events with propertyName
    // equal to 'value'
    // In IE9, propertychange fires for most input events but is buggy and
    // doesn't fire when text is deleted, but conveniently, selectionchange
    // appears to fire in all of the remaining cases so we catch those and
    // forward the event if the value has changed
    // In either case, we don't want to call the event handler if the value
    // is changed from JS so we redefine a setter for `.value` that updates
    // our activeElementValue variable, allowing us to ignore those changes
    //
    // stopWatching() should be a noop here but we call it just in case we
    // missed a blur event somehow.
    stopWatchingForValueChange();
    startWatchingForValueChange(topLevelTarget, topLevelTargetID);
  } else if (topLevelType === topLevelTypes.topBlur) {
    stopWatchingForValueChange();
  }
}

// For IE8 and IE9.
function getTargetIDForInputEventIE(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topSelectionChange || topLevelType === topLevelTypes.topKeyUp || topLevelType === topLevelTypes.topKeyDown) {
    // On the selectionchange event, the target is just document which isn't
    // helpful for us so just check activeElement instead.
    //
    // 99% of the time, keydown and keyup aren't necessary. IE8 fails to fire
    // propertychange on the first input event after setting `value` from a
    // script and fires only keydown, keypress, keyup. Catching keyup usually
    // gets it and catching keydown lets us fire an event for the first
    // keystroke if user does a key repeat (it'll be a little delayed: right
    // before the second keystroke). Other input methods (e.g., paste) seem to
    // fire selectionchange normally.
    if (activeElement && activeElement.value !== activeElementValue) {
      activeElementValue = activeElement.value;
      return activeElementID;
    }
  }
}

/**
 * SECTION: handle `click` event
 */
function shouldUseClickEvent(elem) {
  // Use the `click` event to detect changes to checkbox and radio inputs.
  // This approach works across all browsers, whereas `change` does not fire
  // until `blur` in IE8.
  return elem.nodeName && elem.nodeName.toLowerCase() === 'input' && (elem.type === 'checkbox' || elem.type === 'radio');
}

function getTargetIDForClickEvent(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topClick) {
    return topLevelTargetID;
  }
}

/**
 * This plugin creates an `onChange` event that normalizes change events
 * across form elements. This event fires at a time when it's possible to
 * change the element's value without seeing a flicker.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - select
 */
var ChangeEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function (topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {

    var getTargetIDFunc, handleEventFunc;
    if (shouldUseChangeEvent(topLevelTarget)) {
      if (doesChangeEventBubble) {
        getTargetIDFunc = getTargetIDForChangeEvent;
      } else {
        handleEventFunc = handleEventsForChangeEventIE8;
      }
    } else if (isTextInputElement(topLevelTarget)) {
      if (isInputEventSupported) {
        getTargetIDFunc = getTargetIDForInputEvent;
      } else {
        getTargetIDFunc = getTargetIDForInputEventIE;
        handleEventFunc = handleEventsForInputEventIE;
      }
    } else if (shouldUseClickEvent(topLevelTarget)) {
      getTargetIDFunc = getTargetIDForClickEvent;
    }

    if (getTargetIDFunc) {
      var targetID = getTargetIDFunc(topLevelType, topLevelTarget, topLevelTargetID);
      if (targetID) {
        var event = SyntheticEvent.getPooled(eventTypes.change, targetID, nativeEvent, nativeEventTarget);
        event.type = 'change';
        EventPropagators.accumulateTwoPhaseDispatches(event);
        return event;
      }
    }

    if (handleEventFunc) {
      handleEventFunc(topLevelType, topLevelTarget, topLevelTargetID);
    }
  }

};

module.exports = ChangeEventPlugin;
},{"./EventConstants":70,"./EventPluginHub":71,"./EventPropagators":74,"./ReactUpdates":139,"./SyntheticEvent":148,"./getEventTarget":170,"./isEventSupported":175,"./isTextInputElement":176,"fbjs/lib/ExecutionEnvironment":186,"fbjs/lib/keyOf":204}],63:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ClientReactRootIndex
 * @typechecks
 */

'use strict';

var nextReactRootIndex = 0;

var ClientReactRootIndex = {
  createReactRootIndex: function () {
    return nextReactRootIndex++;
  }
};

module.exports = ClientReactRootIndex;
},{}],64:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMChildrenOperations
 * @typechecks static-only
 */

'use strict';

var Danger = require('./Danger');
var ReactMultiChildUpdateTypes = require('./ReactMultiChildUpdateTypes');
var ReactPerf = require('./ReactPerf');

var setInnerHTML = require('./setInnerHTML');
var setTextContent = require('./setTextContent');
var invariant = require('fbjs/lib/invariant');

/**
 * Inserts `childNode` as a child of `parentNode` at the `index`.
 *
 * @param {DOMElement} parentNode Parent node in which to insert.
 * @param {DOMElement} childNode Child node to insert.
 * @param {number} index Index at which to insert the child.
 * @internal
 */
function insertChildAt(parentNode, childNode, index) {
  // By exploiting arrays returning `undefined` for an undefined index, we can
  // rely exclusively on `insertBefore(node, null)` instead of also using
  // `appendChild(node)`. However, using `undefined` is not allowed by all
  // browsers so we must replace it with `null`.

  // fix render order error in safari
  // IE8 will throw error when index out of list size.
  var beforeChild = index >= parentNode.childNodes.length ? null : parentNode.childNodes.item(index);

  parentNode.insertBefore(childNode, beforeChild);
}

/**
 * Operations for updating with DOM children.
 */
var DOMChildrenOperations = {

  dangerouslyReplaceNodeWithMarkup: Danger.dangerouslyReplaceNodeWithMarkup,

  updateTextContent: setTextContent,

  /**
   * Updates a component's children by processing a series of updates. The
   * update configurations are each expected to have a `parentNode` property.
   *
   * @param {array<object>} updates List of update configurations.
   * @param {array<string>} markupList List of markup strings.
   * @internal
   */
  processUpdates: function (updates, markupList) {
    var update;
    // Mapping from parent IDs to initial child orderings.
    var initialChildren = null;
    // List of children that will be moved or removed.
    var updatedChildren = null;

    for (var i = 0; i < updates.length; i++) {
      update = updates[i];
      if (update.type === ReactMultiChildUpdateTypes.MOVE_EXISTING || update.type === ReactMultiChildUpdateTypes.REMOVE_NODE) {
        var updatedIndex = update.fromIndex;
        var updatedChild = update.parentNode.childNodes[updatedIndex];
        var parentID = update.parentID;

        !updatedChild ? "production" !== 'production' ? invariant(false, 'processUpdates(): Unable to find child %s of element. This ' + 'probably means the DOM was unexpectedly mutated (e.g., by the ' + 'browser), usually due to forgetting a <tbody> when using tables, ' + 'nesting tags like <form>, <p>, or <a>, or using non-SVG elements ' + 'in an <svg> parent. Try inspecting the child nodes of the element ' + 'with React ID `%s`.', updatedIndex, parentID) : invariant(false) : undefined;

        initialChildren = initialChildren || {};
        initialChildren[parentID] = initialChildren[parentID] || [];
        initialChildren[parentID][updatedIndex] = updatedChild;

        updatedChildren = updatedChildren || [];
        updatedChildren.push(updatedChild);
      }
    }

    var renderedMarkup;
    // markupList is either a list of markup or just a list of elements
    if (markupList.length && typeof markupList[0] === 'string') {
      renderedMarkup = Danger.dangerouslyRenderMarkup(markupList);
    } else {
      renderedMarkup = markupList;
    }

    // Remove updated children first so that `toIndex` is consistent.
    if (updatedChildren) {
      for (var j = 0; j < updatedChildren.length; j++) {
        updatedChildren[j].parentNode.removeChild(updatedChildren[j]);
      }
    }

    for (var k = 0; k < updates.length; k++) {
      update = updates[k];
      switch (update.type) {
        case ReactMultiChildUpdateTypes.INSERT_MARKUP:
          insertChildAt(update.parentNode, renderedMarkup[update.markupIndex], update.toIndex);
          break;
        case ReactMultiChildUpdateTypes.MOVE_EXISTING:
          insertChildAt(update.parentNode, initialChildren[update.parentID][update.fromIndex], update.toIndex);
          break;
        case ReactMultiChildUpdateTypes.SET_MARKUP:
          setInnerHTML(update.parentNode, update.content);
          break;
        case ReactMultiChildUpdateTypes.TEXT_CONTENT:
          setTextContent(update.parentNode, update.content);
          break;
        case ReactMultiChildUpdateTypes.REMOVE_NODE:
          // Already removed by the for-loop above.
          break;
      }
    }
  }

};

ReactPerf.measureMethods(DOMChildrenOperations, 'DOMChildrenOperations', {
  updateTextContent: 'updateTextContent'
});

module.exports = DOMChildrenOperations;
},{"./Danger":67,"./ReactMultiChildUpdateTypes":123,"./ReactPerf":127,"./setInnerHTML":180,"./setTextContent":181,"fbjs/lib/invariant":200}],65:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMProperty
 * @typechecks static-only
 */

'use strict';

var invariant = require('fbjs/lib/invariant');

function checkMask(value, bitmask) {
  return (value & bitmask) === bitmask;
}

var DOMPropertyInjection = {
  /**
   * Mapping from normalized, camelcased property names to a configuration that
   * specifies how the associated DOM property should be accessed or rendered.
   */
  MUST_USE_ATTRIBUTE: 0x1,
  MUST_USE_PROPERTY: 0x2,
  HAS_SIDE_EFFECTS: 0x4,
  HAS_BOOLEAN_VALUE: 0x8,
  HAS_NUMERIC_VALUE: 0x10,
  HAS_POSITIVE_NUMERIC_VALUE: 0x20 | 0x10,
  HAS_OVERLOADED_BOOLEAN_VALUE: 0x40,

  /**
   * Inject some specialized knowledge about the DOM. This takes a config object
   * with the following properties:
   *
   * isCustomAttribute: function that given an attribute name will return true
   * if it can be inserted into the DOM verbatim. Useful for data-* or aria-*
   * attributes where it's impossible to enumerate all of the possible
   * attribute names,
   *
   * Properties: object mapping DOM property name to one of the
   * DOMPropertyInjection constants or null. If your attribute isn't in here,
   * it won't get written to the DOM.
   *
   * DOMAttributeNames: object mapping React attribute name to the DOM
   * attribute name. Attribute names not specified use the **lowercase**
   * normalized name.
   *
   * DOMAttributeNamespaces: object mapping React attribute name to the DOM
   * attribute namespace URL. (Attribute names not specified use no namespace.)
   *
   * DOMPropertyNames: similar to DOMAttributeNames but for DOM properties.
   * Property names not specified use the normalized name.
   *
   * DOMMutationMethods: Properties that require special mutation methods. If
   * `value` is undefined, the mutation method should unset the property.
   *
   * @param {object} domPropertyConfig the config as described above.
   */
  injectDOMPropertyConfig: function (domPropertyConfig) {
    var Injection = DOMPropertyInjection;
    var Properties = domPropertyConfig.Properties || {};
    var DOMAttributeNamespaces = domPropertyConfig.DOMAttributeNamespaces || {};
    var DOMAttributeNames = domPropertyConfig.DOMAttributeNames || {};
    var DOMPropertyNames = domPropertyConfig.DOMPropertyNames || {};
    var DOMMutationMethods = domPropertyConfig.DOMMutationMethods || {};

    if (domPropertyConfig.isCustomAttribute) {
      DOMProperty._isCustomAttributeFunctions.push(domPropertyConfig.isCustomAttribute);
    }

    for (var propName in Properties) {
      !!DOMProperty.properties.hasOwnProperty(propName) ? "production" !== 'production' ? invariant(false, 'injectDOMPropertyConfig(...): You\'re trying to inject DOM property ' + '\'%s\' which has already been injected. You may be accidentally ' + 'injecting the same DOM property config twice, or you may be ' + 'injecting two configs that have conflicting property names.', propName) : invariant(false) : undefined;

      var lowerCased = propName.toLowerCase();
      var propConfig = Properties[propName];

      var propertyInfo = {
        attributeName: lowerCased,
        attributeNamespace: null,
        propertyName: propName,
        mutationMethod: null,

        mustUseAttribute: checkMask(propConfig, Injection.MUST_USE_ATTRIBUTE),
        mustUseProperty: checkMask(propConfig, Injection.MUST_USE_PROPERTY),
        hasSideEffects: checkMask(propConfig, Injection.HAS_SIDE_EFFECTS),
        hasBooleanValue: checkMask(propConfig, Injection.HAS_BOOLEAN_VALUE),
        hasNumericValue: checkMask(propConfig, Injection.HAS_NUMERIC_VALUE),
        hasPositiveNumericValue: checkMask(propConfig, Injection.HAS_POSITIVE_NUMERIC_VALUE),
        hasOverloadedBooleanValue: checkMask(propConfig, Injection.HAS_OVERLOADED_BOOLEAN_VALUE)
      };

      !(!propertyInfo.mustUseAttribute || !propertyInfo.mustUseProperty) ? "production" !== 'production' ? invariant(false, 'DOMProperty: Cannot require using both attribute and property: %s', propName) : invariant(false) : undefined;
      !(propertyInfo.mustUseProperty || !propertyInfo.hasSideEffects) ? "production" !== 'production' ? invariant(false, 'DOMProperty: Properties that have side effects must use property: %s', propName) : invariant(false) : undefined;
      !(propertyInfo.hasBooleanValue + propertyInfo.hasNumericValue + propertyInfo.hasOverloadedBooleanValue <= 1) ? "production" !== 'production' ? invariant(false, 'DOMProperty: Value can be one of boolean, overloaded boolean, or ' + 'numeric value, but not a combination: %s', propName) : invariant(false) : undefined;

      if ("production" !== 'production') {
        DOMProperty.getPossibleStandardName[lowerCased] = propName;
      }

      if (DOMAttributeNames.hasOwnProperty(propName)) {
        var attributeName = DOMAttributeNames[propName];
        propertyInfo.attributeName = attributeName;
        if ("production" !== 'production') {
          DOMProperty.getPossibleStandardName[attributeName] = propName;
        }
      }

      if (DOMAttributeNamespaces.hasOwnProperty(propName)) {
        propertyInfo.attributeNamespace = DOMAttributeNamespaces[propName];
      }

      if (DOMPropertyNames.hasOwnProperty(propName)) {
        propertyInfo.propertyName = DOMPropertyNames[propName];
      }

      if (DOMMutationMethods.hasOwnProperty(propName)) {
        propertyInfo.mutationMethod = DOMMutationMethods[propName];
      }

      DOMProperty.properties[propName] = propertyInfo;
    }
  }
};
var defaultValueCache = {};

/**
 * DOMProperty exports lookup objects that can be used like functions:
 *
 *   > DOMProperty.isValid['id']
 *   true
 *   > DOMProperty.isValid['foobar']
 *   undefined
 *
 * Although this may be confusing, it performs better in general.
 *
 * @see http://jsperf.com/key-exists
 * @see http://jsperf.com/key-missing
 */
var DOMProperty = {

  ID_ATTRIBUTE_NAME: 'data-reactid',

  /**
   * Map from property "standard name" to an object with info about how to set
   * the property in the DOM. Each object contains:
   *
   * attributeName:
   *   Used when rendering markup or with `*Attribute()`.
   * attributeNamespace
   * propertyName:
   *   Used on DOM node instances. (This includes properties that mutate due to
   *   external factors.)
   * mutationMethod:
   *   If non-null, used instead of the property or `setAttribute()` after
   *   initial render.
   * mustUseAttribute:
   *   Whether the property must be accessed and mutated using `*Attribute()`.
   *   (This includes anything that fails `<propName> in <element>`.)
   * mustUseProperty:
   *   Whether the property must be accessed and mutated as an object property.
   * hasSideEffects:
   *   Whether or not setting a value causes side effects such as triggering
   *   resources to be loaded or text selection changes. If true, we read from
   *   the DOM before updating to ensure that the value is only set if it has
   *   changed.
   * hasBooleanValue:
   *   Whether the property should be removed when set to a falsey value.
   * hasNumericValue:
   *   Whether the property must be numeric or parse as a numeric and should be
   *   removed when set to a falsey value.
   * hasPositiveNumericValue:
   *   Whether the property must be positive numeric or parse as a positive
   *   numeric and should be removed when set to a falsey value.
   * hasOverloadedBooleanValue:
   *   Whether the property can be used as a flag as well as with a value.
   *   Removed when strictly equal to false; present without a value when
   *   strictly equal to true; present with a value otherwise.
   */
  properties: {},

  /**
   * Mapping from lowercase property names to the properly cased version, used
   * to warn in the case of missing properties. Available only in __DEV__.
   * @type {Object}
   */
  getPossibleStandardName: "production" !== 'production' ? {} : null,

  /**
   * All of the isCustomAttribute() functions that have been injected.
   */
  _isCustomAttributeFunctions: [],

  /**
   * Checks whether a property name is a custom attribute.
   * @method
   */
  isCustomAttribute: function (attributeName) {
    for (var i = 0; i < DOMProperty._isCustomAttributeFunctions.length; i++) {
      var isCustomAttributeFn = DOMProperty._isCustomAttributeFunctions[i];
      if (isCustomAttributeFn(attributeName)) {
        return true;
      }
    }
    return false;
  },

  /**
   * Returns the default property value for a DOM property (i.e., not an
   * attribute). Most default values are '' or false, but not all. Worse yet,
   * some (in particular, `type`) vary depending on the type of element.
   *
   * TODO: Is it better to grab all the possible properties when creating an
   * element to avoid having to create the same element twice?
   */
  getDefaultValueForProperty: function (nodeName, prop) {
    var nodeDefaults = defaultValueCache[nodeName];
    var testElement;
    if (!nodeDefaults) {
      defaultValueCache[nodeName] = nodeDefaults = {};
    }
    if (!(prop in nodeDefaults)) {
      testElement = document.createElement(nodeName);
      nodeDefaults[prop] = testElement[prop];
    }
    return nodeDefaults[prop];
  },

  injection: DOMPropertyInjection
};

module.exports = DOMProperty;
},{"fbjs/lib/invariant":200}],66:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMPropertyOperations
 * @typechecks static-only
 */

'use strict';

var DOMProperty = require('./DOMProperty');
var ReactPerf = require('./ReactPerf');

var quoteAttributeValueForBrowser = require('./quoteAttributeValueForBrowser');
var warning = require('fbjs/lib/warning');

// Simplified subset
var VALID_ATTRIBUTE_NAME_REGEX = /^[a-zA-Z_][\w\.\-]*$/;
var illegalAttributeNameCache = {};
var validatedAttributeNameCache = {};

function isAttributeNameSafe(attributeName) {
  if (validatedAttributeNameCache.hasOwnProperty(attributeName)) {
    return true;
  }
  if (illegalAttributeNameCache.hasOwnProperty(attributeName)) {
    return false;
  }
  if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName)) {
    validatedAttributeNameCache[attributeName] = true;
    return true;
  }
  illegalAttributeNameCache[attributeName] = true;
  "production" !== 'production' ? warning(false, 'Invalid attribute name: `%s`', attributeName) : undefined;
  return false;
}

function shouldIgnoreValue(propertyInfo, value) {
  return value == null || propertyInfo.hasBooleanValue && !value || propertyInfo.hasNumericValue && isNaN(value) || propertyInfo.hasPositiveNumericValue && value < 1 || propertyInfo.hasOverloadedBooleanValue && value === false;
}

if ("production" !== 'production') {
  var reactProps = {
    children: true,
    dangerouslySetInnerHTML: true,
    key: true,
    ref: true
  };
  var warnedProperties = {};

  var warnUnknownProperty = function (name) {
    if (reactProps.hasOwnProperty(name) && reactProps[name] || warnedProperties.hasOwnProperty(name) && warnedProperties[name]) {
      return;
    }

    warnedProperties[name] = true;
    var lowerCasedName = name.toLowerCase();

    // data-* attributes should be lowercase; suggest the lowercase version
    var standardName = DOMProperty.isCustomAttribute(lowerCasedName) ? lowerCasedName : DOMProperty.getPossibleStandardName.hasOwnProperty(lowerCasedName) ? DOMProperty.getPossibleStandardName[lowerCasedName] : null;

    // For now, only warn when we have a suggested correction. This prevents
    // logging too much when using transferPropsTo.
    "production" !== 'production' ? warning(standardName == null, 'Unknown DOM property %s. Did you mean %s?', name, standardName) : undefined;
  };
}

/**
 * Operations for dealing with DOM properties.
 */
var DOMPropertyOperations = {

  /**
   * Creates markup for the ID property.
   *
   * @param {string} id Unescaped ID.
   * @return {string} Markup string.
   */
  createMarkupForID: function (id) {
    return DOMProperty.ID_ATTRIBUTE_NAME + '=' + quoteAttributeValueForBrowser(id);
  },

  setAttributeForID: function (node, id) {
    node.setAttribute(DOMProperty.ID_ATTRIBUTE_NAME, id);
  },

  /**
   * Creates markup for a property.
   *
   * @param {string} name
   * @param {*} value
   * @return {?string} Markup string, or null if the property was invalid.
   */
  createMarkupForProperty: function (name, value) {
    var propertyInfo = DOMProperty.properties.hasOwnProperty(name) ? DOMProperty.properties[name] : null;
    if (propertyInfo) {
      if (shouldIgnoreValue(propertyInfo, value)) {
        return '';
      }
      var attributeName = propertyInfo.attributeName;
      if (propertyInfo.hasBooleanValue || propertyInfo.hasOverloadedBooleanValue && value === true) {
        return attributeName + '=""';
      }
      return attributeName + '=' + quoteAttributeValueForBrowser(value);
    } else if (DOMProperty.isCustomAttribute(name)) {
      if (value == null) {
        return '';
      }
      return name + '=' + quoteAttributeValueForBrowser(value);
    } else if ("production" !== 'production') {
      warnUnknownProperty(name);
    }
    return null;
  },

  /**
   * Creates markup for a custom property.
   *
   * @param {string} name
   * @param {*} value
   * @return {string} Markup string, or empty string if the property was invalid.
   */
  createMarkupForCustomAttribute: function (name, value) {
    if (!isAttributeNameSafe(name) || value == null) {
      return '';
    }
    return name + '=' + quoteAttributeValueForBrowser(value);
  },

  /**
   * Sets the value for a property on a node.
   *
   * @param {DOMElement} node
   * @param {string} name
   * @param {*} value
   */
  setValueForProperty: function (node, name, value) {
    var propertyInfo = DOMProperty.properties.hasOwnProperty(name) ? DOMProperty.properties[name] : null;
    if (propertyInfo) {
      var mutationMethod = propertyInfo.mutationMethod;
      if (mutationMethod) {
        mutationMethod(node, value);
      } else if (shouldIgnoreValue(propertyInfo, value)) {
        this.deleteValueForProperty(node, name);
      } else if (propertyInfo.mustUseAttribute) {
        var attributeName = propertyInfo.attributeName;
        var namespace = propertyInfo.attributeNamespace;
        // `setAttribute` with objects becomes only `[object]` in IE8/9,
        // ('' + value) makes it output the correct toString()-value.
        if (namespace) {
          node.setAttributeNS(namespace, attributeName, '' + value);
        } else if (propertyInfo.hasBooleanValue || propertyInfo.hasOverloadedBooleanValue && value === true) {
          node.setAttribute(attributeName, '');
        } else {
          node.setAttribute(attributeName, '' + value);
        }
      } else {
        var propName = propertyInfo.propertyName;
        // Must explicitly cast values for HAS_SIDE_EFFECTS-properties to the
        // property type before comparing; only `value` does and is string.
        if (!propertyInfo.hasSideEffects || '' + node[propName] !== '' + value) {
          // Contrary to `setAttribute`, object properties are properly
          // `toString`ed by IE8/9.
          node[propName] = value;
        }
      }
    } else if (DOMProperty.isCustomAttribute(name)) {
      DOMPropertyOperations.setValueForAttribute(node, name, value);
    } else if ("production" !== 'production') {
      warnUnknownProperty(name);
    }
  },

  setValueForAttribute: function (node, name, value) {
    if (!isAttributeNameSafe(name)) {
      return;
    }
    if (value == null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, '' + value);
    }
  },

  /**
   * Deletes the value for a property on a node.
   *
   * @param {DOMElement} node
   * @param {string} name
   */
  deleteValueForProperty: function (node, name) {
    var propertyInfo = DOMProperty.properties.hasOwnProperty(name) ? DOMProperty.properties[name] : null;
    if (propertyInfo) {
      var mutationMethod = propertyInfo.mutationMethod;
      if (mutationMethod) {
        mutationMethod(node, undefined);
      } else if (propertyInfo.mustUseAttribute) {
        node.removeAttribute(propertyInfo.attributeName);
      } else {
        var propName = propertyInfo.propertyName;
        var defaultValue = DOMProperty.getDefaultValueForProperty(node.nodeName, propName);
        if (!propertyInfo.hasSideEffects || '' + node[propName] !== defaultValue) {
          node[propName] = defaultValue;
        }
      }
    } else if (DOMProperty.isCustomAttribute(name)) {
      node.removeAttribute(name);
    } else if ("production" !== 'production') {
      warnUnknownProperty(name);
    }
  }

};

ReactPerf.measureMethods(DOMPropertyOperations, 'DOMPropertyOperations', {
  setValueForProperty: 'setValueForProperty',
  setValueForAttribute: 'setValueForAttribute',
  deleteValueForProperty: 'deleteValueForProperty'
});

module.exports = DOMPropertyOperations;
},{"./DOMProperty":65,"./ReactPerf":127,"./quoteAttributeValueForBrowser":178,"fbjs/lib/warning":211}],67:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Danger
 * @typechecks static-only
 */

'use strict';

var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');

var createNodesFromMarkup = require('fbjs/lib/createNodesFromMarkup');
var emptyFunction = require('fbjs/lib/emptyFunction');
var getMarkupWrap = require('fbjs/lib/getMarkupWrap');
var invariant = require('fbjs/lib/invariant');

var OPEN_TAG_NAME_EXP = /^(<[^ \/>]+)/;
var RESULT_INDEX_ATTR = 'data-danger-index';

/**
 * Extracts the `nodeName` from a string of markup.
 *
 * NOTE: Extracting the `nodeName` does not require a regular expression match
 * because we make assumptions about React-generated markup (i.e. there are no
 * spaces surrounding the opening tag and there is at least one attribute).
 *
 * @param {string} markup String of markup.
 * @return {string} Node name of the supplied markup.
 * @see http://jsperf.com/extract-nodename
 */
function getNodeName(markup) {
  return markup.substring(1, markup.indexOf(' '));
}

var Danger = {

  /**
   * Renders markup into an array of nodes. The markup is expected to render
   * into a list of root nodes. Also, the length of `resultList` and
   * `markupList` should be the same.
   *
   * @param {array<string>} markupList List of markup strings to render.
   * @return {array<DOMElement>} List of rendered nodes.
   * @internal
   */
  dangerouslyRenderMarkup: function (markupList) {
    !ExecutionEnvironment.canUseDOM ? "production" !== 'production' ? invariant(false, 'dangerouslyRenderMarkup(...): Cannot render markup in a worker ' + 'thread. Make sure `window` and `document` are available globally ' + 'before requiring React when unit testing or use ' + 'ReactDOMServer.renderToString for server rendering.') : invariant(false) : undefined;
    var nodeName;
    var markupByNodeName = {};
    // Group markup by `nodeName` if a wrap is necessary, else by '*'.
    for (var i = 0; i < markupList.length; i++) {
      !markupList[i] ? "production" !== 'production' ? invariant(false, 'dangerouslyRenderMarkup(...): Missing markup.') : invariant(false) : undefined;
      nodeName = getNodeName(markupList[i]);
      nodeName = getMarkupWrap(nodeName) ? nodeName : '*';
      markupByNodeName[nodeName] = markupByNodeName[nodeName] || [];
      markupByNodeName[nodeName][i] = markupList[i];
    }
    var resultList = [];
    var resultListAssignmentCount = 0;
    for (nodeName in markupByNodeName) {
      if (!markupByNodeName.hasOwnProperty(nodeName)) {
        continue;
      }
      var markupListByNodeName = markupByNodeName[nodeName];

      // This for-in loop skips the holes of the sparse array. The order of
      // iteration should follow the order of assignment, which happens to match
      // numerical index order, but we don't rely on that.
      var resultIndex;
      for (resultIndex in markupListByNodeName) {
        if (markupListByNodeName.hasOwnProperty(resultIndex)) {
          var markup = markupListByNodeName[resultIndex];

          // Push the requested markup with an additional RESULT_INDEX_ATTR
          // attribute.  If the markup does not start with a < character, it
          // will be discarded below (with an appropriate console.error).
          markupListByNodeName[resultIndex] = markup.replace(OPEN_TAG_NAME_EXP,
          // This index will be parsed back out below.
          '$1 ' + RESULT_INDEX_ATTR + '="' + resultIndex + '" ');
        }
      }

      // Render each group of markup with similar wrapping `nodeName`.
      var renderNodes = createNodesFromMarkup(markupListByNodeName.join(''), emptyFunction // Do nothing special with <script> tags.
      );

      for (var j = 0; j < renderNodes.length; ++j) {
        var renderNode = renderNodes[j];
        if (renderNode.hasAttribute && renderNode.hasAttribute(RESULT_INDEX_ATTR)) {

          resultIndex = +renderNode.getAttribute(RESULT_INDEX_ATTR);
          renderNode.removeAttribute(RESULT_INDEX_ATTR);

          !!resultList.hasOwnProperty(resultIndex) ? "production" !== 'production' ? invariant(false, 'Danger: Assigning to an already-occupied result index.') : invariant(false) : undefined;

          resultList[resultIndex] = renderNode;

          // This should match resultList.length and markupList.length when
          // we're done.
          resultListAssignmentCount += 1;
        } else if ("production" !== 'production') {
          console.error('Danger: Discarding unexpected node:', renderNode);
        }
      }
    }

    // Although resultList was populated out of order, it should now be a dense
    // array.
    !(resultListAssignmentCount === resultList.length) ? "production" !== 'production' ? invariant(false, 'Danger: Did not assign to every index of resultList.') : invariant(false) : undefined;

    !(resultList.length === markupList.length) ? "production" !== 'production' ? invariant(false, 'Danger: Expected markup to render %s nodes, but rendered %s.', markupList.length, resultList.length) : invariant(false) : undefined;

    return resultList;
  },

  /**
   * Replaces a node with a string of markup at its current position within its
   * parent. The markup must render into a single root node.
   *
   * @param {DOMElement} oldChild Child node to replace.
   * @param {string} markup Markup to render in place of the child node.
   * @internal
   */
  dangerouslyReplaceNodeWithMarkup: function (oldChild, markup) {
    !ExecutionEnvironment.canUseDOM ? "production" !== 'production' ? invariant(false, 'dangerouslyReplaceNodeWithMarkup(...): Cannot render markup in a ' + 'worker thread. Make sure `window` and `document` are available ' + 'globally before requiring React when unit testing or use ' + 'ReactDOMServer.renderToString() for server rendering.') : invariant(false) : undefined;
    !markup ? "production" !== 'production' ? invariant(false, 'dangerouslyReplaceNodeWithMarkup(...): Missing markup.') : invariant(false) : undefined;
    !(oldChild.tagName.toLowerCase() !== 'html') ? "production" !== 'production' ? invariant(false, 'dangerouslyReplaceNodeWithMarkup(...): Cannot replace markup of the ' + '<html> node. This is because browser quirks make this unreliable ' + 'and/or slow. If you want to render to the root you must use ' + 'server rendering. See ReactDOMServer.renderToString().') : invariant(false) : undefined;

    var newChild;
    if (typeof markup === 'string') {
      newChild = createNodesFromMarkup(markup, emptyFunction)[0];
    } else {
      newChild = markup;
    }
    oldChild.parentNode.replaceChild(newChild, oldChild);
  }

};

module.exports = Danger;
},{"fbjs/lib/ExecutionEnvironment":186,"fbjs/lib/createNodesFromMarkup":191,"fbjs/lib/emptyFunction":192,"fbjs/lib/getMarkupWrap":196,"fbjs/lib/invariant":200}],68:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DefaultEventPluginOrder
 */

'use strict';

var keyOf = require('fbjs/lib/keyOf');

/**
 * Module that is injectable into `EventPluginHub`, that specifies a
 * deterministic ordering of `EventPlugin`s. A convenient way to reason about
 * plugins, without having to package every one of them. This is better than
 * having plugins be ordered in the same order that they are injected because
 * that ordering would be influenced by the packaging order.
 * `ResponderEventPlugin` must occur before `SimpleEventPlugin` so that
 * preventing default on events is convenient in `SimpleEventPlugin` handlers.
 */
var DefaultEventPluginOrder = [keyOf({ ResponderEventPlugin: null }), keyOf({ SimpleEventPlugin: null }), keyOf({ TapEventPlugin: null }), keyOf({ EnterLeaveEventPlugin: null }), keyOf({ ChangeEventPlugin: null }), keyOf({ SelectEventPlugin: null }), keyOf({ BeforeInputEventPlugin: null })];

module.exports = DefaultEventPluginOrder;
},{"fbjs/lib/keyOf":204}],69:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EnterLeaveEventPlugin
 * @typechecks static-only
 */

'use strict';

var EventConstants = require('./EventConstants');
var EventPropagators = require('./EventPropagators');
var SyntheticMouseEvent = require('./SyntheticMouseEvent');

var ReactMount = require('./ReactMount');
var keyOf = require('fbjs/lib/keyOf');

var topLevelTypes = EventConstants.topLevelTypes;
var getFirstReactDOM = ReactMount.getFirstReactDOM;

var eventTypes = {
  mouseEnter: {
    registrationName: keyOf({ onMouseEnter: null }),
    dependencies: [topLevelTypes.topMouseOut, topLevelTypes.topMouseOver]
  },
  mouseLeave: {
    registrationName: keyOf({ onMouseLeave: null }),
    dependencies: [topLevelTypes.topMouseOut, topLevelTypes.topMouseOver]
  }
};

var extractedEvents = [null, null];

var EnterLeaveEventPlugin = {

  eventTypes: eventTypes,

  /**
   * For almost every interaction we care about, there will be both a top-level
   * `mouseover` and `mouseout` event that occurs. Only use `mouseout` so that
   * we do not extract duplicate events. However, moving the mouse into the
   * browser from outside will not fire a `mouseout` event. In this case, we use
   * the `mouseover` top-level event.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function (topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
    if (topLevelType === topLevelTypes.topMouseOver && (nativeEvent.relatedTarget || nativeEvent.fromElement)) {
      return null;
    }
    if (topLevelType !== topLevelTypes.topMouseOut && topLevelType !== topLevelTypes.topMouseOver) {
      // Must not be a mouse in or mouse out - ignoring.
      return null;
    }

    var win;
    if (topLevelTarget.window === topLevelTarget) {
      // `topLevelTarget` is probably a window object.
      win = topLevelTarget;
    } else {
      // TODO: Figure out why `ownerDocument` is sometimes undefined in IE8.
      var doc = topLevelTarget.ownerDocument;
      if (doc) {
        win = doc.defaultView || doc.parentWindow;
      } else {
        win = window;
      }
    }

    var from;
    var to;
    var fromID = '';
    var toID = '';
    if (topLevelType === topLevelTypes.topMouseOut) {
      from = topLevelTarget;
      fromID = topLevelTargetID;
      to = getFirstReactDOM(nativeEvent.relatedTarget || nativeEvent.toElement);
      if (to) {
        toID = ReactMount.getID(to);
      } else {
        to = win;
      }
      to = to || win;
    } else {
      from = win;
      to = topLevelTarget;
      toID = topLevelTargetID;
    }

    if (from === to) {
      // Nothing pertains to our managed components.
      return null;
    }

    var leave = SyntheticMouseEvent.getPooled(eventTypes.mouseLeave, fromID, nativeEvent, nativeEventTarget);
    leave.type = 'mouseleave';
    leave.target = from;
    leave.relatedTarget = to;

    var enter = SyntheticMouseEvent.getPooled(eventTypes.mouseEnter, toID, nativeEvent, nativeEventTarget);
    enter.type = 'mouseenter';
    enter.target = to;
    enter.relatedTarget = from;

    EventPropagators.accumulateEnterLeaveDispatches(leave, enter, fromID, toID);

    extractedEvents[0] = leave;
    extractedEvents[1] = enter;

    return extractedEvents;
  }

};

module.exports = EnterLeaveEventPlugin;
},{"./EventConstants":70,"./EventPropagators":74,"./ReactMount":121,"./SyntheticMouseEvent":152,"fbjs/lib/keyOf":204}],70:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventConstants
 */

'use strict';

var keyMirror = require('fbjs/lib/keyMirror');

var PropagationPhases = keyMirror({ bubbled: null, captured: null });

/**
 * Types of raw signals from the browser caught at the top level.
 */
var topLevelTypes = keyMirror({
  topAbort: null,
  topBlur: null,
  topCanPlay: null,
  topCanPlayThrough: null,
  topChange: null,
  topClick: null,
  topCompositionEnd: null,
  topCompositionStart: null,
  topCompositionUpdate: null,
  topContextMenu: null,
  topCopy: null,
  topCut: null,
  topDoubleClick: null,
  topDrag: null,
  topDragEnd: null,
  topDragEnter: null,
  topDragExit: null,
  topDragLeave: null,
  topDragOver: null,
  topDragStart: null,
  topDrop: null,
  topDurationChange: null,
  topEmptied: null,
  topEncrypted: null,
  topEnded: null,
  topError: null,
  topFocus: null,
  topInput: null,
  topKeyDown: null,
  topKeyPress: null,
  topKeyUp: null,
  topLoad: null,
  topLoadedData: null,
  topLoadedMetadata: null,
  topLoadStart: null,
  topMouseDown: null,
  topMouseMove: null,
  topMouseOut: null,
  topMouseOver: null,
  topMouseUp: null,
  topPaste: null,
  topPause: null,
  topPlay: null,
  topPlaying: null,
  topProgress: null,
  topRateChange: null,
  topReset: null,
  topScroll: null,
  topSeeked: null,
  topSeeking: null,
  topSelectionChange: null,
  topStalled: null,
  topSubmit: null,
  topSuspend: null,
  topTextInput: null,
  topTimeUpdate: null,
  topTouchCancel: null,
  topTouchEnd: null,
  topTouchMove: null,
  topTouchStart: null,
  topVolumeChange: null,
  topWaiting: null,
  topWheel: null
});

var EventConstants = {
  topLevelTypes: topLevelTypes,
  PropagationPhases: PropagationPhases
};

module.exports = EventConstants;
},{"fbjs/lib/keyMirror":203}],71:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPluginHub
 */

'use strict';

var EventPluginRegistry = require('./EventPluginRegistry');
var EventPluginUtils = require('./EventPluginUtils');
var ReactErrorUtils = require('./ReactErrorUtils');

var accumulateInto = require('./accumulateInto');
var forEachAccumulated = require('./forEachAccumulated');
var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

/**
 * Internal store for event listeners
 */
var listenerBank = {};

/**
 * Internal queue of events that have accumulated their dispatches and are
 * waiting to have their dispatches executed.
 */
var eventQueue = null;

/**
 * Dispatches an event and releases it back into the pool, unless persistent.
 *
 * @param {?object} event Synthetic event to be dispatched.
 * @param {boolean} simulated If the event is simulated (changes exn behavior)
 * @private
 */
var executeDispatchesAndRelease = function (event, simulated) {
  if (event) {
    EventPluginUtils.executeDispatchesInOrder(event, simulated);

    if (!event.isPersistent()) {
      event.constructor.release(event);
    }
  }
};
var executeDispatchesAndReleaseSimulated = function (e) {
  return executeDispatchesAndRelease(e, true);
};
var executeDispatchesAndReleaseTopLevel = function (e) {
  return executeDispatchesAndRelease(e, false);
};

/**
 * - `InstanceHandle`: [required] Module that performs logical traversals of DOM
 *   hierarchy given ids of the logical DOM elements involved.
 */
var InstanceHandle = null;

function validateInstanceHandle() {
  var valid = InstanceHandle && InstanceHandle.traverseTwoPhase && InstanceHandle.traverseEnterLeave;
  "production" !== 'production' ? warning(valid, 'InstanceHandle not injected before use!') : undefined;
}

/**
 * This is a unified interface for event plugins to be installed and configured.
 *
 * Event plugins can implement the following properties:
 *
 *   `extractEvents` {function(string, DOMEventTarget, string, object): *}
 *     Required. When a top-level event is fired, this method is expected to
 *     extract synthetic events that will in turn be queued and dispatched.
 *
 *   `eventTypes` {object}
 *     Optional, plugins that fire events must publish a mapping of registration
 *     names that are used to register listeners. Values of this mapping must
 *     be objects that contain `registrationName` or `phasedRegistrationNames`.
 *
 *   `executeDispatch` {function(object, function, string)}
 *     Optional, allows plugins to override how an event gets dispatched. By
 *     default, the listener is simply invoked.
 *
 * Each plugin that is injected into `EventsPluginHub` is immediately operable.
 *
 * @public
 */
var EventPluginHub = {

  /**
   * Methods for injecting dependencies.
   */
  injection: {

    /**
     * @param {object} InjectedMount
     * @public
     */
    injectMount: EventPluginUtils.injection.injectMount,

    /**
     * @param {object} InjectedInstanceHandle
     * @public
     */
    injectInstanceHandle: function (InjectedInstanceHandle) {
      InstanceHandle = InjectedInstanceHandle;
      if ("production" !== 'production') {
        validateInstanceHandle();
      }
    },

    getInstanceHandle: function () {
      if ("production" !== 'production') {
        validateInstanceHandle();
      }
      return InstanceHandle;
    },

    /**
     * @param {array} InjectedEventPluginOrder
     * @public
     */
    injectEventPluginOrder: EventPluginRegistry.injectEventPluginOrder,

    /**
     * @param {object} injectedNamesToPlugins Map from names to plugin modules.
     */
    injectEventPluginsByName: EventPluginRegistry.injectEventPluginsByName

  },

  eventNameDispatchConfigs: EventPluginRegistry.eventNameDispatchConfigs,

  registrationNameModules: EventPluginRegistry.registrationNameModules,

  /**
   * Stores `listener` at `listenerBank[registrationName][id]`. Is idempotent.
   *
   * @param {string} id ID of the DOM element.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @param {?function} listener The callback to store.
   */
  putListener: function (id, registrationName, listener) {
    !(typeof listener === 'function') ? "production" !== 'production' ? invariant(false, 'Expected %s listener to be a function, instead got type %s', registrationName, typeof listener) : invariant(false) : undefined;

    var bankForRegistrationName = listenerBank[registrationName] || (listenerBank[registrationName] = {});
    bankForRegistrationName[id] = listener;

    var PluginModule = EventPluginRegistry.registrationNameModules[registrationName];
    if (PluginModule && PluginModule.didPutListener) {
      PluginModule.didPutListener(id, registrationName, listener);
    }
  },

  /**
   * @param {string} id ID of the DOM element.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @return {?function} The stored callback.
   */
  getListener: function (id, registrationName) {
    var bankForRegistrationName = listenerBank[registrationName];
    return bankForRegistrationName && bankForRegistrationName[id];
  },

  /**
   * Deletes a listener from the registration bank.
   *
   * @param {string} id ID of the DOM element.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   */
  deleteListener: function (id, registrationName) {
    var PluginModule = EventPluginRegistry.registrationNameModules[registrationName];
    if (PluginModule && PluginModule.willDeleteListener) {
      PluginModule.willDeleteListener(id, registrationName);
    }

    var bankForRegistrationName = listenerBank[registrationName];
    // TODO: This should never be null -- when is it?
    if (bankForRegistrationName) {
      delete bankForRegistrationName[id];
    }
  },

  /**
   * Deletes all listeners for the DOM element with the supplied ID.
   *
   * @param {string} id ID of the DOM element.
   */
  deleteAllListeners: function (id) {
    for (var registrationName in listenerBank) {
      if (!listenerBank[registrationName][id]) {
        continue;
      }

      var PluginModule = EventPluginRegistry.registrationNameModules[registrationName];
      if (PluginModule && PluginModule.willDeleteListener) {
        PluginModule.willDeleteListener(id, registrationName);
      }

      delete listenerBank[registrationName][id];
    }
  },

  /**
   * Allows registered plugins an opportunity to extract events from top-level
   * native browser events.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @internal
   */
  extractEvents: function (topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
    var events;
    var plugins = EventPluginRegistry.plugins;
    for (var i = 0; i < plugins.length; i++) {
      // Not every plugin in the ordering may be loaded at runtime.
      var possiblePlugin = plugins[i];
      if (possiblePlugin) {
        var extractedEvents = possiblePlugin.extractEvents(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget);
        if (extractedEvents) {
          events = accumulateInto(events, extractedEvents);
        }
      }
    }
    return events;
  },

  /**
   * Enqueues a synthetic event that should be dispatched when
   * `processEventQueue` is invoked.
   *
   * @param {*} events An accumulation of synthetic events.
   * @internal
   */
  enqueueEvents: function (events) {
    if (events) {
      eventQueue = accumulateInto(eventQueue, events);
    }
  },

  /**
   * Dispatches all synthetic events on the event queue.
   *
   * @internal
   */
  processEventQueue: function (simulated) {
    // Set `eventQueue` to null before processing it so that we can tell if more
    // events get enqueued while processing.
    var processingEventQueue = eventQueue;
    eventQueue = null;
    if (simulated) {
      forEachAccumulated(processingEventQueue, executeDispatchesAndReleaseSimulated);
    } else {
      forEachAccumulated(processingEventQueue, executeDispatchesAndReleaseTopLevel);
    }
    !!eventQueue ? "production" !== 'production' ? invariant(false, 'processEventQueue(): Additional events were enqueued while processing ' + 'an event queue. Support for this has not yet been implemented.') : invariant(false) : undefined;
    // This would be a good time to rethrow if any of the event handlers threw.
    ReactErrorUtils.rethrowCaughtError();
  },

  /**
   * These are needed for tests only. Do not use!
   */
  __purge: function () {
    listenerBank = {};
  },

  __getListenerBank: function () {
    return listenerBank;
  }

};

module.exports = EventPluginHub;
},{"./EventPluginRegistry":72,"./EventPluginUtils":73,"./ReactErrorUtils":112,"./accumulateInto":158,"./forEachAccumulated":166,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],72:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPluginRegistry
 * @typechecks static-only
 */

'use strict';

var invariant = require('fbjs/lib/invariant');

/**
 * Injectable ordering of event plugins.
 */
var EventPluginOrder = null;

/**
 * Injectable mapping from names to event plugin modules.
 */
var namesToPlugins = {};

/**
 * Recomputes the plugin list using the injected plugins and plugin ordering.
 *
 * @private
 */
function recomputePluginOrdering() {
  if (!EventPluginOrder) {
    // Wait until an `EventPluginOrder` is injected.
    return;
  }
  for (var pluginName in namesToPlugins) {
    var PluginModule = namesToPlugins[pluginName];
    var pluginIndex = EventPluginOrder.indexOf(pluginName);
    !(pluginIndex > -1) ? "production" !== 'production' ? invariant(false, 'EventPluginRegistry: Cannot inject event plugins that do not exist in ' + 'the plugin ordering, `%s`.', pluginName) : invariant(false) : undefined;
    if (EventPluginRegistry.plugins[pluginIndex]) {
      continue;
    }
    !PluginModule.extractEvents ? "production" !== 'production' ? invariant(false, 'EventPluginRegistry: Event plugins must implement an `extractEvents` ' + 'method, but `%s` does not.', pluginName) : invariant(false) : undefined;
    EventPluginRegistry.plugins[pluginIndex] = PluginModule;
    var publishedEvents = PluginModule.eventTypes;
    for (var eventName in publishedEvents) {
      !publishEventForPlugin(publishedEvents[eventName], PluginModule, eventName) ? "production" !== 'production' ? invariant(false, 'EventPluginRegistry: Failed to publish event `%s` for plugin `%s`.', eventName, pluginName) : invariant(false) : undefined;
    }
  }
}

/**
 * Publishes an event so that it can be dispatched by the supplied plugin.
 *
 * @param {object} dispatchConfig Dispatch configuration for the event.
 * @param {object} PluginModule Plugin publishing the event.
 * @return {boolean} True if the event was successfully published.
 * @private
 */
function publishEventForPlugin(dispatchConfig, PluginModule, eventName) {
  !!EventPluginRegistry.eventNameDispatchConfigs.hasOwnProperty(eventName) ? "production" !== 'production' ? invariant(false, 'EventPluginHub: More than one plugin attempted to publish the same ' + 'event name, `%s`.', eventName) : invariant(false) : undefined;
  EventPluginRegistry.eventNameDispatchConfigs[eventName] = dispatchConfig;

  var phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;
  if (phasedRegistrationNames) {
    for (var phaseName in phasedRegistrationNames) {
      if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
        var phasedRegistrationName = phasedRegistrationNames[phaseName];
        publishRegistrationName(phasedRegistrationName, PluginModule, eventName);
      }
    }
    return true;
  } else if (dispatchConfig.registrationName) {
    publishRegistrationName(dispatchConfig.registrationName, PluginModule, eventName);
    return true;
  }
  return false;
}

/**
 * Publishes a registration name that is used to identify dispatched events and
 * can be used with `EventPluginHub.putListener` to register listeners.
 *
 * @param {string} registrationName Registration name to add.
 * @param {object} PluginModule Plugin publishing the event.
 * @private
 */
function publishRegistrationName(registrationName, PluginModule, eventName) {
  !!EventPluginRegistry.registrationNameModules[registrationName] ? "production" !== 'production' ? invariant(false, 'EventPluginHub: More than one plugin attempted to publish the same ' + 'registration name, `%s`.', registrationName) : invariant(false) : undefined;
  EventPluginRegistry.registrationNameModules[registrationName] = PluginModule;
  EventPluginRegistry.registrationNameDependencies[registrationName] = PluginModule.eventTypes[eventName].dependencies;
}

/**
 * Registers plugins so that they can extract and dispatch events.
 *
 * @see {EventPluginHub}
 */
var EventPluginRegistry = {

  /**
   * Ordered list of injected plugins.
   */
  plugins: [],

  /**
   * Mapping from event name to dispatch config
   */
  eventNameDispatchConfigs: {},

  /**
   * Mapping from registration name to plugin module
   */
  registrationNameModules: {},

  /**
   * Mapping from registration name to event name
   */
  registrationNameDependencies: {},

  /**
   * Injects an ordering of plugins (by plugin name). This allows the ordering
   * to be decoupled from injection of the actual plugins so that ordering is
   * always deterministic regardless of packaging, on-the-fly injection, etc.
   *
   * @param {array} InjectedEventPluginOrder
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginOrder}
   */
  injectEventPluginOrder: function (InjectedEventPluginOrder) {
    !!EventPluginOrder ? "production" !== 'production' ? invariant(false, 'EventPluginRegistry: Cannot inject event plugin ordering more than ' + 'once. You are likely trying to load more than one copy of React.') : invariant(false) : undefined;
    // Clone the ordering so it cannot be dynamically mutated.
    EventPluginOrder = Array.prototype.slice.call(InjectedEventPluginOrder);
    recomputePluginOrdering();
  },

  /**
   * Injects plugins to be used by `EventPluginHub`. The plugin names must be
   * in the ordering injected by `injectEventPluginOrder`.
   *
   * Plugins can be injected as part of page initialization or on-the-fly.
   *
   * @param {object} injectedNamesToPlugins Map from names to plugin modules.
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginsByName}
   */
  injectEventPluginsByName: function (injectedNamesToPlugins) {
    var isOrderingDirty = false;
    for (var pluginName in injectedNamesToPlugins) {
      if (!injectedNamesToPlugins.hasOwnProperty(pluginName)) {
        continue;
      }
      var PluginModule = injectedNamesToPlugins[pluginName];
      if (!namesToPlugins.hasOwnProperty(pluginName) || namesToPlugins[pluginName] !== PluginModule) {
        !!namesToPlugins[pluginName] ? "production" !== 'production' ? invariant(false, 'EventPluginRegistry: Cannot inject two different event plugins ' + 'using the same name, `%s`.', pluginName) : invariant(false) : undefined;
        namesToPlugins[pluginName] = PluginModule;
        isOrderingDirty = true;
      }
    }
    if (isOrderingDirty) {
      recomputePluginOrdering();
    }
  },

  /**
   * Looks up the plugin for the supplied event.
   *
   * @param {object} event A synthetic event.
   * @return {?object} The plugin that created the supplied event.
   * @internal
   */
  getPluginModuleForEvent: function (event) {
    var dispatchConfig = event.dispatchConfig;
    if (dispatchConfig.registrationName) {
      return EventPluginRegistry.registrationNameModules[dispatchConfig.registrationName] || null;
    }
    for (var phase in dispatchConfig.phasedRegistrationNames) {
      if (!dispatchConfig.phasedRegistrationNames.hasOwnProperty(phase)) {
        continue;
      }
      var PluginModule = EventPluginRegistry.registrationNameModules[dispatchConfig.phasedRegistrationNames[phase]];
      if (PluginModule) {
        return PluginModule;
      }
    }
    return null;
  },

  /**
   * Exposed for unit testing.
   * @private
   */
  _resetEventPlugins: function () {
    EventPluginOrder = null;
    for (var pluginName in namesToPlugins) {
      if (namesToPlugins.hasOwnProperty(pluginName)) {
        delete namesToPlugins[pluginName];
      }
    }
    EventPluginRegistry.plugins.length = 0;

    var eventNameDispatchConfigs = EventPluginRegistry.eventNameDispatchConfigs;
    for (var eventName in eventNameDispatchConfigs) {
      if (eventNameDispatchConfigs.hasOwnProperty(eventName)) {
        delete eventNameDispatchConfigs[eventName];
      }
    }

    var registrationNameModules = EventPluginRegistry.registrationNameModules;
    for (var registrationName in registrationNameModules) {
      if (registrationNameModules.hasOwnProperty(registrationName)) {
        delete registrationNameModules[registrationName];
      }
    }
  }

};

module.exports = EventPluginRegistry;
},{"fbjs/lib/invariant":200}],73:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPluginUtils
 */

'use strict';

var EventConstants = require('./EventConstants');
var ReactErrorUtils = require('./ReactErrorUtils');

var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

/**
 * Injected dependencies:
 */

/**
 * - `Mount`: [required] Module that can convert between React dom IDs and
 *   actual node references.
 */
var injection = {
  Mount: null,
  injectMount: function (InjectedMount) {
    injection.Mount = InjectedMount;
    if ("production" !== 'production') {
      "production" !== 'production' ? warning(InjectedMount && InjectedMount.getNode && InjectedMount.getID, 'EventPluginUtils.injection.injectMount(...): Injected Mount ' + 'module is missing getNode or getID.') : undefined;
    }
  }
};

var topLevelTypes = EventConstants.topLevelTypes;

function isEndish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseUp || topLevelType === topLevelTypes.topTouchEnd || topLevelType === topLevelTypes.topTouchCancel;
}

function isMoveish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseMove || topLevelType === topLevelTypes.topTouchMove;
}
function isStartish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseDown || topLevelType === topLevelTypes.topTouchStart;
}

var validateEventDispatches;
if ("production" !== 'production') {
  validateEventDispatches = function (event) {
    var dispatchListeners = event._dispatchListeners;
    var dispatchIDs = event._dispatchIDs;

    var listenersIsArr = Array.isArray(dispatchListeners);
    var idsIsArr = Array.isArray(dispatchIDs);
    var IDsLen = idsIsArr ? dispatchIDs.length : dispatchIDs ? 1 : 0;
    var listenersLen = listenersIsArr ? dispatchListeners.length : dispatchListeners ? 1 : 0;

    "production" !== 'production' ? warning(idsIsArr === listenersIsArr && IDsLen === listenersLen, 'EventPluginUtils: Invalid `event`.') : undefined;
  };
}

/**
 * Dispatch the event to the listener.
 * @param {SyntheticEvent} event SyntheticEvent to handle
 * @param {boolean} simulated If the event is simulated (changes exn behavior)
 * @param {function} listener Application-level callback
 * @param {string} domID DOM id to pass to the callback.
 */
function executeDispatch(event, simulated, listener, domID) {
  var type = event.type || 'unknown-event';
  event.currentTarget = injection.Mount.getNode(domID);
  if (simulated) {
    ReactErrorUtils.invokeGuardedCallbackWithCatch(type, listener, event, domID);
  } else {
    ReactErrorUtils.invokeGuardedCallback(type, listener, event, domID);
  }
  event.currentTarget = null;
}

/**
 * Standard/simple iteration through an event's collected dispatches.
 */
function executeDispatchesInOrder(event, simulated) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchIDs = event._dispatchIDs;
  if ("production" !== 'production') {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      // Listeners and IDs are two parallel arrays that are always in sync.
      executeDispatch(event, simulated, dispatchListeners[i], dispatchIDs[i]);
    }
  } else if (dispatchListeners) {
    executeDispatch(event, simulated, dispatchListeners, dispatchIDs);
  }
  event._dispatchListeners = null;
  event._dispatchIDs = null;
}

/**
 * Standard/simple iteration through an event's collected dispatches, but stops
 * at the first dispatch execution returning true, and returns that id.
 *
 * @return {?string} id of the first dispatch execution who's listener returns
 * true, or null if no listener returned true.
 */
function executeDispatchesInOrderStopAtTrueImpl(event) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchIDs = event._dispatchIDs;
  if ("production" !== 'production') {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      // Listeners and IDs are two parallel arrays that are always in sync.
      if (dispatchListeners[i](event, dispatchIDs[i])) {
        return dispatchIDs[i];
      }
    }
  } else if (dispatchListeners) {
    if (dispatchListeners(event, dispatchIDs)) {
      return dispatchIDs;
    }
  }
  return null;
}

/**
 * @see executeDispatchesInOrderStopAtTrueImpl
 */
function executeDispatchesInOrderStopAtTrue(event) {
  var ret = executeDispatchesInOrderStopAtTrueImpl(event);
  event._dispatchIDs = null;
  event._dispatchListeners = null;
  return ret;
}

/**
 * Execution of a "direct" dispatch - there must be at most one dispatch
 * accumulated on the event or it is considered an error. It doesn't really make
 * sense for an event with multiple dispatches (bubbled) to keep track of the
 * return values at each dispatch execution, but it does tend to make sense when
 * dealing with "direct" dispatches.
 *
 * @return {*} The return value of executing the single dispatch.
 */
function executeDirectDispatch(event) {
  if ("production" !== 'production') {
    validateEventDispatches(event);
  }
  var dispatchListener = event._dispatchListeners;
  var dispatchID = event._dispatchIDs;
  !!Array.isArray(dispatchListener) ? "production" !== 'production' ? invariant(false, 'executeDirectDispatch(...): Invalid `event`.') : invariant(false) : undefined;
  var res = dispatchListener ? dispatchListener(event, dispatchID) : null;
  event._dispatchListeners = null;
  event._dispatchIDs = null;
  return res;
}

/**
 * @param {SyntheticEvent} event
 * @return {boolean} True iff number of dispatches accumulated is greater than 0.
 */
function hasDispatches(event) {
  return !!event._dispatchListeners;
}

/**
 * General utilities that are useful in creating custom Event Plugins.
 */
var EventPluginUtils = {
  isEndish: isEndish,
  isMoveish: isMoveish,
  isStartish: isStartish,

  executeDirectDispatch: executeDirectDispatch,
  executeDispatchesInOrder: executeDispatchesInOrder,
  executeDispatchesInOrderStopAtTrue: executeDispatchesInOrderStopAtTrue,
  hasDispatches: hasDispatches,

  getNode: function (id) {
    return injection.Mount.getNode(id);
  },
  getID: function (node) {
    return injection.Mount.getID(node);
  },

  injection: injection
};

module.exports = EventPluginUtils;
},{"./EventConstants":70,"./ReactErrorUtils":112,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],74:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPropagators
 */

'use strict';

var EventConstants = require('./EventConstants');
var EventPluginHub = require('./EventPluginHub');

var warning = require('fbjs/lib/warning');

var accumulateInto = require('./accumulateInto');
var forEachAccumulated = require('./forEachAccumulated');

var PropagationPhases = EventConstants.PropagationPhases;
var getListener = EventPluginHub.getListener;

/**
 * Some event types have a notion of different registration names for different
 * "phases" of propagation. This finds listeners by a given phase.
 */
function listenerAtPhase(id, event, propagationPhase) {
  var registrationName = event.dispatchConfig.phasedRegistrationNames[propagationPhase];
  return getListener(id, registrationName);
}

/**
 * Tags a `SyntheticEvent` with dispatched listeners. Creating this function
 * here, allows us to not have to bind or create functions for each event.
 * Mutating the event's members allows us to not have to create a wrapping
 * "dispatch" object that pairs the event with the listener.
 */
function accumulateDirectionalDispatches(domID, upwards, event) {
  if ("production" !== 'production') {
    "production" !== 'production' ? warning(domID, 'Dispatching id must not be null') : undefined;
  }
  var phase = upwards ? PropagationPhases.bubbled : PropagationPhases.captured;
  var listener = listenerAtPhase(domID, event, phase);
  if (listener) {
    event._dispatchListeners = accumulateInto(event._dispatchListeners, listener);
    event._dispatchIDs = accumulateInto(event._dispatchIDs, domID);
  }
}

/**
 * Collect dispatches (must be entirely collected before dispatching - see unit
 * tests). Lazily allocate the array to conserve memory.  We must loop through
 * each event and perform the traversal for each one. We cannot perform a
 * single traversal for the entire collection of events because each event may
 * have a different target.
 */
function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    EventPluginHub.injection.getInstanceHandle().traverseTwoPhase(event.dispatchMarker, accumulateDirectionalDispatches, event);
  }
}

/**
 * Same as `accumulateTwoPhaseDispatchesSingle`, but skips over the targetID.
 */
function accumulateTwoPhaseDispatchesSingleSkipTarget(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    EventPluginHub.injection.getInstanceHandle().traverseTwoPhaseSkipTarget(event.dispatchMarker, accumulateDirectionalDispatches, event);
  }
}

/**
 * Accumulates without regard to direction, does not look for phased
 * registration names. Same as `accumulateDirectDispatchesSingle` but without
 * requiring that the `dispatchMarker` be the same as the dispatched ID.
 */
function accumulateDispatches(id, ignoredDirection, event) {
  if (event && event.dispatchConfig.registrationName) {
    var registrationName = event.dispatchConfig.registrationName;
    var listener = getListener(id, registrationName);
    if (listener) {
      event._dispatchListeners = accumulateInto(event._dispatchListeners, listener);
      event._dispatchIDs = accumulateInto(event._dispatchIDs, id);
    }
  }
}

/**
 * Accumulates dispatches on an `SyntheticEvent`, but only for the
 * `dispatchMarker`.
 * @param {SyntheticEvent} event
 */
function accumulateDirectDispatchesSingle(event) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event.dispatchMarker, null, event);
  }
}

function accumulateTwoPhaseDispatches(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle);
}

function accumulateTwoPhaseDispatchesSkipTarget(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingleSkipTarget);
}

function accumulateEnterLeaveDispatches(leave, enter, fromID, toID) {
  EventPluginHub.injection.getInstanceHandle().traverseEnterLeave(fromID, toID, accumulateDispatches, leave, enter);
}

function accumulateDirectDispatches(events) {
  forEachAccumulated(events, accumulateDirectDispatchesSingle);
}

/**
 * A small set of propagation patterns, each of which will accept a small amount
 * of information, and generate a set of "dispatch ready event objects" - which
 * are sets of events that have already been annotated with a set of dispatched
 * listener functions/ids. The API is designed this way to discourage these
 * propagation strategies from actually executing the dispatches, since we
 * always want to collect the entire set of dispatches before executing event a
 * single one.
 *
 * @constructor EventPropagators
 */
var EventPropagators = {
  accumulateTwoPhaseDispatches: accumulateTwoPhaseDispatches,
  accumulateTwoPhaseDispatchesSkipTarget: accumulateTwoPhaseDispatchesSkipTarget,
  accumulateDirectDispatches: accumulateDirectDispatches,
  accumulateEnterLeaveDispatches: accumulateEnterLeaveDispatches
};

module.exports = EventPropagators;
},{"./EventConstants":70,"./EventPluginHub":71,"./accumulateInto":158,"./forEachAccumulated":166,"fbjs/lib/warning":211}],75:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FallbackCompositionState
 * @typechecks static-only
 */

'use strict';

var PooledClass = require('./PooledClass');

var assign = require('./Object.assign');
var getTextContentAccessor = require('./getTextContentAccessor');

/**
 * This helper class stores information about text content of a target node,
 * allowing comparison of content before and after a given event.
 *
 * Identify the node where selection currently begins, then observe
 * both its text content and its current position in the DOM. Since the
 * browser may natively replace the target node during composition, we can
 * use its position to find its replacement.
 *
 * @param {DOMEventTarget} root
 */
function FallbackCompositionState(root) {
  this._root = root;
  this._startText = this.getText();
  this._fallbackText = null;
}

assign(FallbackCompositionState.prototype, {
  destructor: function () {
    this._root = null;
    this._startText = null;
    this._fallbackText = null;
  },

  /**
   * Get current text of input.
   *
   * @return {string}
   */
  getText: function () {
    if ('value' in this._root) {
      return this._root.value;
    }
    return this._root[getTextContentAccessor()];
  },

  /**
   * Determine the differing substring between the initially stored
   * text content and the current content.
   *
   * @return {string}
   */
  getData: function () {
    if (this._fallbackText) {
      return this._fallbackText;
    }

    var start;
    var startValue = this._startText;
    var startLength = startValue.length;
    var end;
    var endValue = this.getText();
    var endLength = endValue.length;

    for (start = 0; start < startLength; start++) {
      if (startValue[start] !== endValue[start]) {
        break;
      }
    }

    var minEnd = startLength - start;
    for (end = 1; end <= minEnd; end++) {
      if (startValue[startLength - end] !== endValue[endLength - end]) {
        break;
      }
    }

    var sliceTail = end > 1 ? 1 - end : undefined;
    this._fallbackText = endValue.slice(start, sliceTail);
    return this._fallbackText;
  }
});

PooledClass.addPoolingTo(FallbackCompositionState);

module.exports = FallbackCompositionState;
},{"./Object.assign":78,"./PooledClass":79,"./getTextContentAccessor":173}],76:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule HTMLDOMPropertyConfig
 */

'use strict';

var DOMProperty = require('./DOMProperty');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');

var MUST_USE_ATTRIBUTE = DOMProperty.injection.MUST_USE_ATTRIBUTE;
var MUST_USE_PROPERTY = DOMProperty.injection.MUST_USE_PROPERTY;
var HAS_BOOLEAN_VALUE = DOMProperty.injection.HAS_BOOLEAN_VALUE;
var HAS_SIDE_EFFECTS = DOMProperty.injection.HAS_SIDE_EFFECTS;
var HAS_NUMERIC_VALUE = DOMProperty.injection.HAS_NUMERIC_VALUE;
var HAS_POSITIVE_NUMERIC_VALUE = DOMProperty.injection.HAS_POSITIVE_NUMERIC_VALUE;
var HAS_OVERLOADED_BOOLEAN_VALUE = DOMProperty.injection.HAS_OVERLOADED_BOOLEAN_VALUE;

var hasSVG;
if (ExecutionEnvironment.canUseDOM) {
  var implementation = document.implementation;
  hasSVG = implementation && implementation.hasFeature && implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1');
}

var HTMLDOMPropertyConfig = {
  isCustomAttribute: RegExp.prototype.test.bind(/^(data|aria)-[a-z_][a-z\d_.\-]*$/),
  Properties: {
    /**
     * Standard Properties
     */
    accept: null,
    acceptCharset: null,
    accessKey: null,
    action: null,
    allowFullScreen: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    allowTransparency: MUST_USE_ATTRIBUTE,
    alt: null,
    async: HAS_BOOLEAN_VALUE,
    autoComplete: null,
    // autoFocus is polyfilled/normalized by AutoFocusUtils
    // autoFocus: HAS_BOOLEAN_VALUE,
    autoPlay: HAS_BOOLEAN_VALUE,
    capture: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    cellPadding: null,
    cellSpacing: null,
    charSet: MUST_USE_ATTRIBUTE,
    challenge: MUST_USE_ATTRIBUTE,
    checked: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    classID: MUST_USE_ATTRIBUTE,
    // To set className on SVG elements, it's necessary to use .setAttribute;
    // this works on HTML elements too in all browsers except IE8. Conveniently,
    // IE8 doesn't support SVG and so we can simply use the attribute in
    // browsers that support SVG and the property in browsers that don't,
    // regardless of whether the element is HTML or SVG.
    className: hasSVG ? MUST_USE_ATTRIBUTE : MUST_USE_PROPERTY,
    cols: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    colSpan: null,
    content: null,
    contentEditable: null,
    contextMenu: MUST_USE_ATTRIBUTE,
    controls: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    coords: null,
    crossOrigin: null,
    data: null, // For `<object />` acts as `src`.
    dateTime: MUST_USE_ATTRIBUTE,
    'default': HAS_BOOLEAN_VALUE,
    defer: HAS_BOOLEAN_VALUE,
    dir: null,
    disabled: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    download: HAS_OVERLOADED_BOOLEAN_VALUE,
    draggable: null,
    encType: null,
    form: MUST_USE_ATTRIBUTE,
    formAction: MUST_USE_ATTRIBUTE,
    formEncType: MUST_USE_ATTRIBUTE,
    formMethod: MUST_USE_ATTRIBUTE,
    formNoValidate: HAS_BOOLEAN_VALUE,
    formTarget: MUST_USE_ATTRIBUTE,
    frameBorder: MUST_USE_ATTRIBUTE,
    headers: null,
    height: MUST_USE_ATTRIBUTE,
    hidden: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    high: null,
    href: null,
    hrefLang: null,
    htmlFor: null,
    httpEquiv: null,
    icon: null,
    id: MUST_USE_PROPERTY,
    inputMode: MUST_USE_ATTRIBUTE,
    integrity: null,
    is: MUST_USE_ATTRIBUTE,
    keyParams: MUST_USE_ATTRIBUTE,
    keyType: MUST_USE_ATTRIBUTE,
    kind: null,
    label: null,
    lang: null,
    list: MUST_USE_ATTRIBUTE,
    loop: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    low: null,
    manifest: MUST_USE_ATTRIBUTE,
    marginHeight: null,
    marginWidth: null,
    max: null,
    maxLength: MUST_USE_ATTRIBUTE,
    media: MUST_USE_ATTRIBUTE,
    mediaGroup: null,
    method: null,
    min: null,
    minLength: MUST_USE_ATTRIBUTE,
    multiple: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    muted: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    name: null,
    nonce: MUST_USE_ATTRIBUTE,
    noValidate: HAS_BOOLEAN_VALUE,
    open: HAS_BOOLEAN_VALUE,
    optimum: null,
    pattern: null,
    placeholder: null,
    poster: null,
    preload: null,
    radioGroup: null,
    readOnly: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    rel: null,
    required: HAS_BOOLEAN_VALUE,
    reversed: HAS_BOOLEAN_VALUE,
    role: MUST_USE_ATTRIBUTE,
    rows: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    rowSpan: null,
    sandbox: null,
    scope: null,
    scoped: HAS_BOOLEAN_VALUE,
    scrolling: null,
    seamless: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    selected: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    shape: null,
    size: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    sizes: MUST_USE_ATTRIBUTE,
    span: HAS_POSITIVE_NUMERIC_VALUE,
    spellCheck: null,
    src: null,
    srcDoc: MUST_USE_PROPERTY,
    srcLang: null,
    srcSet: MUST_USE_ATTRIBUTE,
    start: HAS_NUMERIC_VALUE,
    step: null,
    style: null,
    summary: null,
    tabIndex: null,
    target: null,
    title: null,
    type: null,
    useMap: null,
    value: MUST_USE_PROPERTY | HAS_SIDE_EFFECTS,
    width: MUST_USE_ATTRIBUTE,
    wmode: MUST_USE_ATTRIBUTE,
    wrap: null,

    /**
     * RDFa Properties
     */
    about: MUST_USE_ATTRIBUTE,
    datatype: MUST_USE_ATTRIBUTE,
    inlist: MUST_USE_ATTRIBUTE,
    prefix: MUST_USE_ATTRIBUTE,
    // property is also supported for OpenGraph in meta tags.
    property: MUST_USE_ATTRIBUTE,
    resource: MUST_USE_ATTRIBUTE,
    'typeof': MUST_USE_ATTRIBUTE,
    vocab: MUST_USE_ATTRIBUTE,

    /**
     * Non-standard Properties
     */
    // autoCapitalize and autoCorrect are supported in Mobile Safari for
    // keyboard hints.
    autoCapitalize: MUST_USE_ATTRIBUTE,
    autoCorrect: MUST_USE_ATTRIBUTE,
    // autoSave allows WebKit/Blink to persist values of input fields on page reloads
    autoSave: null,
    // color is for Safari mask-icon link
    color: null,
    // itemProp, itemScope, itemType are for
    // Microdata support. See http://schema.org/docs/gs.html
    itemProp: MUST_USE_ATTRIBUTE,
    itemScope: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    itemType: MUST_USE_ATTRIBUTE,
    // itemID and itemRef are for Microdata support as well but
    // only specified in the the WHATWG spec document. See
    // https://html.spec.whatwg.org/multipage/microdata.html#microdata-dom-api
    itemID: MUST_USE_ATTRIBUTE,
    itemRef: MUST_USE_ATTRIBUTE,
    // results show looking glass icon and recent searches on input
    // search fields in WebKit/Blink
    results: null,
    // IE-only attribute that specifies security restrictions on an iframe
    // as an alternative to the sandbox attribute on IE<10
    security: MUST_USE_ATTRIBUTE,
    // IE-only attribute that controls focus behavior
    unselectable: MUST_USE_ATTRIBUTE
  },
  DOMAttributeNames: {
    acceptCharset: 'accept-charset',
    className: 'class',
    htmlFor: 'for',
    httpEquiv: 'http-equiv'
  },
  DOMPropertyNames: {
    autoComplete: 'autocomplete',
    autoFocus: 'autofocus',
    autoPlay: 'autoplay',
    autoSave: 'autosave',
    // `encoding` is equivalent to `enctype`, IE8 lacks an `enctype` setter.
    // http://www.w3.org/TR/html5/forms.html#dom-fs-encoding
    encType: 'encoding',
    hrefLang: 'hreflang',
    radioGroup: 'radiogroup',
    spellCheck: 'spellcheck',
    srcDoc: 'srcdoc',
    srcSet: 'srcset'
  }
};

module.exports = HTMLDOMPropertyConfig;
},{"./DOMProperty":65,"fbjs/lib/ExecutionEnvironment":186}],77:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule LinkedValueUtils
 * @typechecks static-only
 */

'use strict';

var ReactPropTypes = require('./ReactPropTypes');
var ReactPropTypeLocations = require('./ReactPropTypeLocations');

var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

var hasReadOnlyValue = {
  'button': true,
  'checkbox': true,
  'image': true,
  'hidden': true,
  'radio': true,
  'reset': true,
  'submit': true
};

function _assertSingleLink(inputProps) {
  !(inputProps.checkedLink == null || inputProps.valueLink == null) ? "production" !== 'production' ? invariant(false, 'Cannot provide a checkedLink and a valueLink. If you want to use ' + 'checkedLink, you probably don\'t want to use valueLink and vice versa.') : invariant(false) : undefined;
}
function _assertValueLink(inputProps) {
  _assertSingleLink(inputProps);
  !(inputProps.value == null && inputProps.onChange == null) ? "production" !== 'production' ? invariant(false, 'Cannot provide a valueLink and a value or onChange event. If you want ' + 'to use value or onChange, you probably don\'t want to use valueLink.') : invariant(false) : undefined;
}

function _assertCheckedLink(inputProps) {
  _assertSingleLink(inputProps);
  !(inputProps.checked == null && inputProps.onChange == null) ? "production" !== 'production' ? invariant(false, 'Cannot provide a checkedLink and a checked property or onChange event. ' + 'If you want to use checked or onChange, you probably don\'t want to ' + 'use checkedLink') : invariant(false) : undefined;
}

var propTypes = {
  value: function (props, propName, componentName) {
    if (!props[propName] || hasReadOnlyValue[props.type] || props.onChange || props.readOnly || props.disabled) {
      return null;
    }
    return new Error('You provided a `value` prop to a form field without an ' + '`onChange` handler. This will render a read-only field. If ' + 'the field should be mutable use `defaultValue`. Otherwise, ' + 'set either `onChange` or `readOnly`.');
  },
  checked: function (props, propName, componentName) {
    if (!props[propName] || props.onChange || props.readOnly || props.disabled) {
      return null;
    }
    return new Error('You provided a `checked` prop to a form field without an ' + '`onChange` handler. This will render a read-only field. If ' + 'the field should be mutable use `defaultChecked`. Otherwise, ' + 'set either `onChange` or `readOnly`.');
  },
  onChange: ReactPropTypes.func
};

var loggedTypeFailures = {};
function getDeclarationErrorAddendum(owner) {
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

/**
 * Provide a linked `value` attribute for controlled forms. You should not use
 * this outside of the ReactDOM controlled form components.
 */
var LinkedValueUtils = {
  checkPropTypes: function (tagName, props, owner) {
    for (var propName in propTypes) {
      if (propTypes.hasOwnProperty(propName)) {
        var error = propTypes[propName](props, propName, tagName, ReactPropTypeLocations.prop);
      }
      if (error instanceof Error && !(error.message in loggedTypeFailures)) {
        // Only monitor this failure once because there tends to be a lot of the
        // same error.
        loggedTypeFailures[error.message] = true;

        var addendum = getDeclarationErrorAddendum(owner);
        "production" !== 'production' ? warning(false, 'Failed form propType: %s%s', error.message, addendum) : undefined;
      }
    }
  },

  /**
   * @param {object} inputProps Props for form component
   * @return {*} current value of the input either from value prop or link.
   */
  getValue: function (inputProps) {
    if (inputProps.valueLink) {
      _assertValueLink(inputProps);
      return inputProps.valueLink.value;
    }
    return inputProps.value;
  },

  /**
   * @param {object} inputProps Props for form component
   * @return {*} current checked status of the input either from checked prop
   *             or link.
   */
  getChecked: function (inputProps) {
    if (inputProps.checkedLink) {
      _assertCheckedLink(inputProps);
      return inputProps.checkedLink.value;
    }
    return inputProps.checked;
  },

  /**
   * @param {object} inputProps Props for form component
   * @param {SyntheticEvent} event change event to handle
   */
  executeOnChange: function (inputProps, event) {
    if (inputProps.valueLink) {
      _assertValueLink(inputProps);
      return inputProps.valueLink.requestChange(event.target.value);
    } else if (inputProps.checkedLink) {
      _assertCheckedLink(inputProps);
      return inputProps.checkedLink.requestChange(event.target.checked);
    } else if (inputProps.onChange) {
      return inputProps.onChange.call(undefined, event);
    }
  }
};

module.exports = LinkedValueUtils;
},{"./ReactPropTypeLocations":129,"./ReactPropTypes":130,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],78:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Object.assign
 */

// https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.assign

'use strict';

function assign(target, sources) {
  if (target == null) {
    throw new TypeError('Object.assign target cannot be null or undefined');
  }

  var to = Object(target);
  var hasOwnProperty = Object.prototype.hasOwnProperty;

  for (var nextIndex = 1; nextIndex < arguments.length; nextIndex++) {
    var nextSource = arguments[nextIndex];
    if (nextSource == null) {
      continue;
    }

    var from = Object(nextSource);

    // We don't currently support accessors nor proxies. Therefore this
    // copy cannot throw. If we ever supported this then we must handle
    // exceptions and side-effects. We don't support symbols so they won't
    // be transferred.

    for (var key in from) {
      if (hasOwnProperty.call(from, key)) {
        to[key] = from[key];
      }
    }
  }

  return to;
}

module.exports = assign;
},{}],79:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule PooledClass
 */

'use strict';

var invariant = require('fbjs/lib/invariant');

/**
 * Static poolers. Several custom versions for each potential number of
 * arguments. A completely generic pooler is easy to implement, but would
 * require accessing the `arguments` object. In each of these, `this` refers to
 * the Class itself, not an instance. If any others are needed, simply add them
 * here, or in their own files.
 */
var oneArgumentPooler = function (copyFieldsFrom) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, copyFieldsFrom);
    return instance;
  } else {
    return new Klass(copyFieldsFrom);
  }
};

var twoArgumentPooler = function (a1, a2) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2);
    return instance;
  } else {
    return new Klass(a1, a2);
  }
};

var threeArgumentPooler = function (a1, a2, a3) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3);
    return instance;
  } else {
    return new Klass(a1, a2, a3);
  }
};

var fourArgumentPooler = function (a1, a2, a3, a4) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3, a4);
    return instance;
  } else {
    return new Klass(a1, a2, a3, a4);
  }
};

var fiveArgumentPooler = function (a1, a2, a3, a4, a5) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3, a4, a5);
    return instance;
  } else {
    return new Klass(a1, a2, a3, a4, a5);
  }
};

var standardReleaser = function (instance) {
  var Klass = this;
  !(instance instanceof Klass) ? "production" !== 'production' ? invariant(false, 'Trying to release an instance into a pool of a different type.') : invariant(false) : undefined;
  instance.destructor();
  if (Klass.instancePool.length < Klass.poolSize) {
    Klass.instancePool.push(instance);
  }
};

var DEFAULT_POOL_SIZE = 10;
var DEFAULT_POOLER = oneArgumentPooler;

/**
 * Augments `CopyConstructor` to be a poolable class, augmenting only the class
 * itself (statically) not adding any prototypical fields. Any CopyConstructor
 * you give this may have a `poolSize` property, and will look for a
 * prototypical `destructor` on instances (optional).
 *
 * @param {Function} CopyConstructor Constructor that can be used to reset.
 * @param {Function} pooler Customizable pooler.
 */
var addPoolingTo = function (CopyConstructor, pooler) {
  var NewKlass = CopyConstructor;
  NewKlass.instancePool = [];
  NewKlass.getPooled = pooler || DEFAULT_POOLER;
  if (!NewKlass.poolSize) {
    NewKlass.poolSize = DEFAULT_POOL_SIZE;
  }
  NewKlass.release = standardReleaser;
  return NewKlass;
};

var PooledClass = {
  addPoolingTo: addPoolingTo,
  oneArgumentPooler: oneArgumentPooler,
  twoArgumentPooler: twoArgumentPooler,
  threeArgumentPooler: threeArgumentPooler,
  fourArgumentPooler: fourArgumentPooler,
  fiveArgumentPooler: fiveArgumentPooler
};

module.exports = PooledClass;
},{"fbjs/lib/invariant":200}],80:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule React
 */

'use strict';

var ReactDOM = require('./ReactDOM');
var ReactDOMServer = require('./ReactDOMServer');
var ReactIsomorphic = require('./ReactIsomorphic');

var assign = require('./Object.assign');
var deprecated = require('./deprecated');

// `version` will be added here by ReactIsomorphic.
var React = {};

assign(React, ReactIsomorphic);

assign(React, {
  // ReactDOM
  findDOMNode: deprecated('findDOMNode', 'ReactDOM', 'react-dom', ReactDOM, ReactDOM.findDOMNode),
  render: deprecated('render', 'ReactDOM', 'react-dom', ReactDOM, ReactDOM.render),
  unmountComponentAtNode: deprecated('unmountComponentAtNode', 'ReactDOM', 'react-dom', ReactDOM, ReactDOM.unmountComponentAtNode),

  // ReactDOMServer
  renderToString: deprecated('renderToString', 'ReactDOMServer', 'react-dom/server', ReactDOMServer, ReactDOMServer.renderToString),
  renderToStaticMarkup: deprecated('renderToStaticMarkup', 'ReactDOMServer', 'react-dom/server', ReactDOMServer, ReactDOMServer.renderToStaticMarkup)
});

React.__SECRET_DOM_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactDOM;
React.__SECRET_DOM_SERVER_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactDOMServer;

module.exports = React;
},{"./Object.assign":78,"./ReactDOM":91,"./ReactDOMServer":101,"./ReactIsomorphic":119,"./deprecated":162}],81:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactBrowserComponentMixin
 */

'use strict';

var ReactInstanceMap = require('./ReactInstanceMap');

var findDOMNode = require('./findDOMNode');
var warning = require('fbjs/lib/warning');

var didWarnKey = '_getDOMNodeDidWarn';

var ReactBrowserComponentMixin = {
  /**
   * Returns the DOM node rendered by this component.
   *
   * @return {DOMElement} The root node of this component.
   * @final
   * @protected
   */
  getDOMNode: function () {
    "production" !== 'production' ? warning(this.constructor[didWarnKey], '%s.getDOMNode(...) is deprecated. Please use ' + 'ReactDOM.findDOMNode(instance) instead.', ReactInstanceMap.get(this).getName() || this.tagName || 'Unknown') : undefined;
    this.constructor[didWarnKey] = true;
    return findDOMNode(this);
  }
};

module.exports = ReactBrowserComponentMixin;
},{"./ReactInstanceMap":118,"./findDOMNode":164,"fbjs/lib/warning":211}],82:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactBrowserEventEmitter
 * @typechecks static-only
 */

'use strict';

var EventConstants = require('./EventConstants');
var EventPluginHub = require('./EventPluginHub');
var EventPluginRegistry = require('./EventPluginRegistry');
var ReactEventEmitterMixin = require('./ReactEventEmitterMixin');
var ReactPerf = require('./ReactPerf');
var ViewportMetrics = require('./ViewportMetrics');

var assign = require('./Object.assign');
var isEventSupported = require('./isEventSupported');

/**
 * Summary of `ReactBrowserEventEmitter` event handling:
 *
 *  - Top-level delegation is used to trap most native browser events. This
 *    may only occur in the main thread and is the responsibility of
 *    ReactEventListener, which is injected and can therefore support pluggable
 *    event sources. This is the only work that occurs in the main thread.
 *
 *  - We normalize and de-duplicate events to account for browser quirks. This
 *    may be done in the worker thread.
 *
 *  - Forward these native events (with the associated top-level type used to
 *    trap it) to `EventPluginHub`, which in turn will ask plugins if they want
 *    to extract any synthetic events.
 *
 *  - The `EventPluginHub` will then process each event by annotating them with
 *    "dispatches", a sequence of listeners and IDs that care about that event.
 *
 *  - The `EventPluginHub` then dispatches the events.
 *
 * Overview of React and the event system:
 *
 * +------------+    .
 * |    DOM     |    .
 * +------------+    .
 *       |           .
 *       v           .
 * +------------+    .
 * | ReactEvent |    .
 * |  Listener  |    .
 * +------------+    .                         +-----------+
 *       |           .               +--------+|SimpleEvent|
 *       |           .               |         |Plugin     |
 * +-----|------+    .               v         +-----------+
 * |     |      |    .    +--------------+                    +------------+
 * |     +-----------.--->|EventPluginHub|                    |    Event   |
 * |            |    .    |              |     +-----------+  | Propagators|
 * | ReactEvent |    .    |              |     |TapEvent   |  |------------|
 * |  Emitter   |    .    |              |<---+|Plugin     |  |other plugin|
 * |            |    .    |              |     +-----------+  |  utilities |
 * |     +-----------.--->|              |                    +------------+
 * |     |      |    .    +--------------+
 * +-----|------+    .                ^        +-----------+
 *       |           .                |        |Enter/Leave|
 *       +           .                +-------+|Plugin     |
 * +-------------+   .                         +-----------+
 * | application |   .
 * |-------------|   .
 * |             |   .
 * |             |   .
 * +-------------+   .
 *                   .
 *    React Core     .  General Purpose Event Plugin System
 */

var alreadyListeningTo = {};
var isMonitoringScrollValue = false;
var reactTopListenersCounter = 0;

// For events like 'submit' which don't consistently bubble (which we trap at a
// lower node than `document`), binding at `document` would cause duplicate
// events so we don't include them here
var topEventMapping = {
  topAbort: 'abort',
  topBlur: 'blur',
  topCanPlay: 'canplay',
  topCanPlayThrough: 'canplaythrough',
  topChange: 'change',
  topClick: 'click',
  topCompositionEnd: 'compositionend',
  topCompositionStart: 'compositionstart',
  topCompositionUpdate: 'compositionupdate',
  topContextMenu: 'contextmenu',
  topCopy: 'copy',
  topCut: 'cut',
  topDoubleClick: 'dblclick',
  topDrag: 'drag',
  topDragEnd: 'dragend',
  topDragEnter: 'dragenter',
  topDragExit: 'dragexit',
  topDragLeave: 'dragleave',
  topDragOver: 'dragover',
  topDragStart: 'dragstart',
  topDrop: 'drop',
  topDurationChange: 'durationchange',
  topEmptied: 'emptied',
  topEncrypted: 'encrypted',
  topEnded: 'ended',
  topError: 'error',
  topFocus: 'focus',
  topInput: 'input',
  topKeyDown: 'keydown',
  topKeyPress: 'keypress',
  topKeyUp: 'keyup',
  topLoadedData: 'loadeddata',
  topLoadedMetadata: 'loadedmetadata',
  topLoadStart: 'loadstart',
  topMouseDown: 'mousedown',
  topMouseMove: 'mousemove',
  topMouseOut: 'mouseout',
  topMouseOver: 'mouseover',
  topMouseUp: 'mouseup',
  topPaste: 'paste',
  topPause: 'pause',
  topPlay: 'play',
  topPlaying: 'playing',
  topProgress: 'progress',
  topRateChange: 'ratechange',
  topScroll: 'scroll',
  topSeeked: 'seeked',
  topSeeking: 'seeking',
  topSelectionChange: 'selectionchange',
  topStalled: 'stalled',
  topSuspend: 'suspend',
  topTextInput: 'textInput',
  topTimeUpdate: 'timeupdate',
  topTouchCancel: 'touchcancel',
  topTouchEnd: 'touchend',
  topTouchMove: 'touchmove',
  topTouchStart: 'touchstart',
  topVolumeChange: 'volumechange',
  topWaiting: 'waiting',
  topWheel: 'wheel'
};

/**
 * To ensure no conflicts with other potential React instances on the page
 */
var topListenersIDKey = '_reactListenersID' + String(Math.random()).slice(2);

function getListeningForDocument(mountAt) {
  // In IE8, `mountAt` is a host object and doesn't have `hasOwnProperty`
  // directly.
  if (!Object.prototype.hasOwnProperty.call(mountAt, topListenersIDKey)) {
    mountAt[topListenersIDKey] = reactTopListenersCounter++;
    alreadyListeningTo[mountAt[topListenersIDKey]] = {};
  }
  return alreadyListeningTo[mountAt[topListenersIDKey]];
}

/**
 * `ReactBrowserEventEmitter` is used to attach top-level event listeners. For
 * example:
 *
 *   ReactBrowserEventEmitter.putListener('myID', 'onClick', myFunction);
 *
 * This would allocate a "registration" of `('onClick', myFunction)` on 'myID'.
 *
 * @internal
 */
var ReactBrowserEventEmitter = assign({}, ReactEventEmitterMixin, {

  /**
   * Injectable event backend
   */
  ReactEventListener: null,

  injection: {
    /**
     * @param {object} ReactEventListener
     */
    injectReactEventListener: function (ReactEventListener) {
      ReactEventListener.setHandleTopLevel(ReactBrowserEventEmitter.handleTopLevel);
      ReactBrowserEventEmitter.ReactEventListener = ReactEventListener;
    }
  },

  /**
   * Sets whether or not any created callbacks should be enabled.
   *
   * @param {boolean} enabled True if callbacks should be enabled.
   */
  setEnabled: function (enabled) {
    if (ReactBrowserEventEmitter.ReactEventListener) {
      ReactBrowserEventEmitter.ReactEventListener.setEnabled(enabled);
    }
  },

  /**
   * @return {boolean} True if callbacks are enabled.
   */
  isEnabled: function () {
    return !!(ReactBrowserEventEmitter.ReactEventListener && ReactBrowserEventEmitter.ReactEventListener.isEnabled());
  },

  /**
   * We listen for bubbled touch events on the document object.
   *
   * Firefox v8.01 (and possibly others) exhibited strange behavior when
   * mounting `onmousemove` events at some node that was not the document
   * element. The symptoms were that if your mouse is not moving over something
   * contained within that mount point (for example on the background) the
   * top-level listeners for `onmousemove` won't be called. However, if you
   * register the `mousemove` on the document object, then it will of course
   * catch all `mousemove`s. This along with iOS quirks, justifies restricting
   * top-level listeners to the document object only, at least for these
   * movement types of events and possibly all events.
   *
   * @see http://www.quirksmode.org/blog/archives/2010/09/click_event_del.html
   *
   * Also, `keyup`/`keypress`/`keydown` do not bubble to the window on IE, but
   * they bubble to document.
   *
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @param {object} contentDocumentHandle Document which owns the container
   */
  listenTo: function (registrationName, contentDocumentHandle) {
    var mountAt = contentDocumentHandle;
    var isListening = getListeningForDocument(mountAt);
    var dependencies = EventPluginRegistry.registrationNameDependencies[registrationName];

    var topLevelTypes = EventConstants.topLevelTypes;
    for (var i = 0; i < dependencies.length; i++) {
      var dependency = dependencies[i];
      if (!(isListening.hasOwnProperty(dependency) && isListening[dependency])) {
        if (dependency === topLevelTypes.topWheel) {
          if (isEventSupported('wheel')) {
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topWheel, 'wheel', mountAt);
          } else if (isEventSupported('mousewheel')) {
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topWheel, 'mousewheel', mountAt);
          } else {
            // Firefox needs to capture a different mouse scroll event.
            // @see http://www.quirksmode.org/dom/events/tests/scroll.html
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topWheel, 'DOMMouseScroll', mountAt);
          }
        } else if (dependency === topLevelTypes.topScroll) {

          if (isEventSupported('scroll', true)) {
            ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(topLevelTypes.topScroll, 'scroll', mountAt);
          } else {
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topScroll, 'scroll', ReactBrowserEventEmitter.ReactEventListener.WINDOW_HANDLE);
          }
        } else if (dependency === topLevelTypes.topFocus || dependency === topLevelTypes.topBlur) {

          if (isEventSupported('focus', true)) {
            ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(topLevelTypes.topFocus, 'focus', mountAt);
            ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(topLevelTypes.topBlur, 'blur', mountAt);
          } else if (isEventSupported('focusin')) {
            // IE has `focusin` and `focusout` events which bubble.
            // @see http://www.quirksmode.org/blog/archives/2008/04/delegating_the.html
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topFocus, 'focusin', mountAt);
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topBlur, 'focusout', mountAt);
          }

          // to make sure blur and focus event listeners are only attached once
          isListening[topLevelTypes.topBlur] = true;
          isListening[topLevelTypes.topFocus] = true;
        } else if (topEventMapping.hasOwnProperty(dependency)) {
          ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(dependency, topEventMapping[dependency], mountAt);
        }

        isListening[dependency] = true;
      }
    }
  },

  trapBubbledEvent: function (topLevelType, handlerBaseName, handle) {
    return ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelType, handlerBaseName, handle);
  },

  trapCapturedEvent: function (topLevelType, handlerBaseName, handle) {
    return ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(topLevelType, handlerBaseName, handle);
  },

  /**
   * Listens to window scroll and resize events. We cache scroll values so that
   * application code can access them without triggering reflows.
   *
   * NOTE: Scroll events do not bubble.
   *
   * @see http://www.quirksmode.org/dom/events/scroll.html
   */
  ensureScrollValueMonitoring: function () {
    if (!isMonitoringScrollValue) {
      var refresh = ViewportMetrics.refreshScrollValues;
      ReactBrowserEventEmitter.ReactEventListener.monitorScrollValue(refresh);
      isMonitoringScrollValue = true;
    }
  },

  eventNameDispatchConfigs: EventPluginHub.eventNameDispatchConfigs,

  registrationNameModules: EventPluginHub.registrationNameModules,

  putListener: EventPluginHub.putListener,

  getListener: EventPluginHub.getListener,

  deleteListener: EventPluginHub.deleteListener,

  deleteAllListeners: EventPluginHub.deleteAllListeners

});

ReactPerf.measureMethods(ReactBrowserEventEmitter, 'ReactBrowserEventEmitter', {
  putListener: 'putListener',
  deleteListener: 'deleteListener'
});

module.exports = ReactBrowserEventEmitter;
},{"./EventConstants":70,"./EventPluginHub":71,"./EventPluginRegistry":72,"./Object.assign":78,"./ReactEventEmitterMixin":113,"./ReactPerf":127,"./ViewportMetrics":157,"./isEventSupported":175}],83:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactChildReconciler
 * @typechecks static-only
 */

'use strict';

var ReactReconciler = require('./ReactReconciler');

var instantiateReactComponent = require('./instantiateReactComponent');
var shouldUpdateReactComponent = require('./shouldUpdateReactComponent');
var traverseAllChildren = require('./traverseAllChildren');
var warning = require('fbjs/lib/warning');

function instantiateChild(childInstances, child, name) {
  // We found a component instance.
  var keyUnique = childInstances[name] === undefined;
  if ("production" !== 'production') {
    "production" !== 'production' ? warning(keyUnique, 'flattenChildren(...): Encountered two children with the same key, ' + '`%s`. Child keys must be unique; when two children share a key, only ' + 'the first child will be used.', name) : undefined;
  }
  if (child != null && keyUnique) {
    childInstances[name] = instantiateReactComponent(child, null);
  }
}

/**
 * ReactChildReconciler provides helpers for initializing or updating a set of
 * children. Its output is suitable for passing it onto ReactMultiChild which
 * does diffed reordering and insertion.
 */
var ReactChildReconciler = {
  /**
   * Generates a "mount image" for each of the supplied children. In the case
   * of `ReactDOMComponent`, a mount image is a string of markup.
   *
   * @param {?object} nestedChildNodes Nested child maps.
   * @return {?object} A set of child instances.
   * @internal
   */
  instantiateChildren: function (nestedChildNodes, transaction, context) {
    if (nestedChildNodes == null) {
      return null;
    }
    var childInstances = {};
    traverseAllChildren(nestedChildNodes, instantiateChild, childInstances);
    return childInstances;
  },

  /**
   * Updates the rendered children and returns a new set of children.
   *
   * @param {?object} prevChildren Previously initialized set of children.
   * @param {?object} nextChildren Flat child element maps.
   * @param {ReactReconcileTransaction} transaction
   * @param {object} context
   * @return {?object} A new set of child instances.
   * @internal
   */
  updateChildren: function (prevChildren, nextChildren, transaction, context) {
    // We currently don't have a way to track moves here but if we use iterators
    // instead of for..in we can zip the iterators and check if an item has
    // moved.
    // TODO: If nothing has changed, return the prevChildren object so that we
    // can quickly bailout if nothing has changed.
    if (!nextChildren && !prevChildren) {
      return null;
    }
    var name;
    for (name in nextChildren) {
      if (!nextChildren.hasOwnProperty(name)) {
        continue;
      }
      var prevChild = prevChildren && prevChildren[name];
      var prevElement = prevChild && prevChild._currentElement;
      var nextElement = nextChildren[name];
      if (prevChild != null && shouldUpdateReactComponent(prevElement, nextElement)) {
        ReactReconciler.receiveComponent(prevChild, nextElement, transaction, context);
        nextChildren[name] = prevChild;
      } else {
        if (prevChild) {
          ReactReconciler.unmountComponent(prevChild, name);
        }
        // The child must be instantiated before it's mounted.
        var nextChildInstance = instantiateReactComponent(nextElement, null);
        nextChildren[name] = nextChildInstance;
      }
    }
    // Unmount children that are no longer present.
    for (name in prevChildren) {
      if (prevChildren.hasOwnProperty(name) && !(nextChildren && nextChildren.hasOwnProperty(name))) {
        ReactReconciler.unmountComponent(prevChildren[name]);
      }
    }
    return nextChildren;
  },

  /**
   * Unmounts all rendered children. This should be used to clean up children
   * when this component is unmounted.
   *
   * @param {?object} renderedChildren Previously initialized set of children.
   * @internal
   */
  unmountChildren: function (renderedChildren) {
    for (var name in renderedChildren) {
      if (renderedChildren.hasOwnProperty(name)) {
        var renderedChild = renderedChildren[name];
        ReactReconciler.unmountComponent(renderedChild);
      }
    }
  }

};

module.exports = ReactChildReconciler;
},{"./ReactReconciler":132,"./instantiateReactComponent":174,"./shouldUpdateReactComponent":182,"./traverseAllChildren":183,"fbjs/lib/warning":211}],84:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactChildren
 */

'use strict';

var PooledClass = require('./PooledClass');
var ReactElement = require('./ReactElement');

var emptyFunction = require('fbjs/lib/emptyFunction');
var traverseAllChildren = require('./traverseAllChildren');

var twoArgumentPooler = PooledClass.twoArgumentPooler;
var fourArgumentPooler = PooledClass.fourArgumentPooler;

var userProvidedKeyEscapeRegex = /\/(?!\/)/g;
function escapeUserProvidedKey(text) {
  return ('' + text).replace(userProvidedKeyEscapeRegex, '//');
}

/**
 * PooledClass representing the bookkeeping associated with performing a child
 * traversal. Allows avoiding binding callbacks.
 *
 * @constructor ForEachBookKeeping
 * @param {!function} forEachFunction Function to perform traversal with.
 * @param {?*} forEachContext Context to perform context with.
 */
function ForEachBookKeeping(forEachFunction, forEachContext) {
  this.func = forEachFunction;
  this.context = forEachContext;
  this.count = 0;
}
ForEachBookKeeping.prototype.destructor = function () {
  this.func = null;
  this.context = null;
  this.count = 0;
};
PooledClass.addPoolingTo(ForEachBookKeeping, twoArgumentPooler);

function forEachSingleChild(bookKeeping, child, name) {
  var func = bookKeeping.func;
  var context = bookKeeping.context;

  func.call(context, child, bookKeeping.count++);
}

/**
 * Iterates through children that are typically specified as `props.children`.
 *
 * The provided forEachFunc(child, index) will be called for each
 * leaf child.
 *
 * @param {?*} children Children tree container.
 * @param {function(*, int)} forEachFunc
 * @param {*} forEachContext Context for forEachContext.
 */
function forEachChildren(children, forEachFunc, forEachContext) {
  if (children == null) {
    return children;
  }
  var traverseContext = ForEachBookKeeping.getPooled(forEachFunc, forEachContext);
  traverseAllChildren(children, forEachSingleChild, traverseContext);
  ForEachBookKeeping.release(traverseContext);
}

/**
 * PooledClass representing the bookkeeping associated with performing a child
 * mapping. Allows avoiding binding callbacks.
 *
 * @constructor MapBookKeeping
 * @param {!*} mapResult Object containing the ordered map of results.
 * @param {!function} mapFunction Function to perform mapping with.
 * @param {?*} mapContext Context to perform mapping with.
 */
function MapBookKeeping(mapResult, keyPrefix, mapFunction, mapContext) {
  this.result = mapResult;
  this.keyPrefix = keyPrefix;
  this.func = mapFunction;
  this.context = mapContext;
  this.count = 0;
}
MapBookKeeping.prototype.destructor = function () {
  this.result = null;
  this.keyPrefix = null;
  this.func = null;
  this.context = null;
  this.count = 0;
};
PooledClass.addPoolingTo(MapBookKeeping, fourArgumentPooler);

function mapSingleChildIntoContext(bookKeeping, child, childKey) {
  var result = bookKeeping.result;
  var keyPrefix = bookKeeping.keyPrefix;
  var func = bookKeeping.func;
  var context = bookKeeping.context;

  var mappedChild = func.call(context, child, bookKeeping.count++);
  if (Array.isArray(mappedChild)) {
    mapIntoWithKeyPrefixInternal(mappedChild, result, childKey, emptyFunction.thatReturnsArgument);
  } else if (mappedChild != null) {
    if (ReactElement.isValidElement(mappedChild)) {
      mappedChild = ReactElement.cloneAndReplaceKey(mappedChild,
      // Keep both the (mapped) and old keys if they differ, just as
      // traverseAllChildren used to do for objects as children
      keyPrefix + (mappedChild !== child ? escapeUserProvidedKey(mappedChild.key || '') + '/' : '') + childKey);
    }
    result.push(mappedChild);
  }
}

function mapIntoWithKeyPrefixInternal(children, array, prefix, func, context) {
  var escapedPrefix = '';
  if (prefix != null) {
    escapedPrefix = escapeUserProvidedKey(prefix) + '/';
  }
  var traverseContext = MapBookKeeping.getPooled(array, escapedPrefix, func, context);
  traverseAllChildren(children, mapSingleChildIntoContext, traverseContext);
  MapBookKeeping.release(traverseContext);
}

/**
 * Maps children that are typically specified as `props.children`.
 *
 * The provided mapFunction(child, key, index) will be called for each
 * leaf child.
 *
 * @param {?*} children Children tree container.
 * @param {function(*, int)} func The map function.
 * @param {*} context Context for mapFunction.
 * @return {object} Object containing the ordered map of results.
 */
function mapChildren(children, func, context) {
  if (children == null) {
    return children;
  }
  var result = [];
  mapIntoWithKeyPrefixInternal(children, result, null, func, context);
  return result;
}

function forEachSingleChildDummy(traverseContext, child, name) {
  return null;
}

/**
 * Count the number of children that are typically specified as
 * `props.children`.
 *
 * @param {?*} children Children tree container.
 * @return {number} The number of children.
 */
function countChildren(children, context) {
  return traverseAllChildren(children, forEachSingleChildDummy, null);
}

/**
 * Flatten a children object (typically specified as `props.children`) and
 * return an array with appropriately re-keyed children.
 */
function toArray(children) {
  var result = [];
  mapIntoWithKeyPrefixInternal(children, result, null, emptyFunction.thatReturnsArgument);
  return result;
}

var ReactChildren = {
  forEach: forEachChildren,
  map: mapChildren,
  mapIntoWithKeyPrefixInternal: mapIntoWithKeyPrefixInternal,
  count: countChildren,
  toArray: toArray
};

module.exports = ReactChildren;
},{"./PooledClass":79,"./ReactElement":108,"./traverseAllChildren":183,"fbjs/lib/emptyFunction":192}],85:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactClass
 */

'use strict';

var ReactComponent = require('./ReactComponent');
var ReactElement = require('./ReactElement');
var ReactPropTypeLocations = require('./ReactPropTypeLocations');
var ReactPropTypeLocationNames = require('./ReactPropTypeLocationNames');
var ReactNoopUpdateQueue = require('./ReactNoopUpdateQueue');

var assign = require('./Object.assign');
var emptyObject = require('fbjs/lib/emptyObject');
var invariant = require('fbjs/lib/invariant');
var keyMirror = require('fbjs/lib/keyMirror');
var keyOf = require('fbjs/lib/keyOf');
var warning = require('fbjs/lib/warning');

var MIXINS_KEY = keyOf({ mixins: null });

/**
 * Policies that describe methods in `ReactClassInterface`.
 */
var SpecPolicy = keyMirror({
  /**
   * These methods may be defined only once by the class specification or mixin.
   */
  DEFINE_ONCE: null,
  /**
   * These methods may be defined by both the class specification and mixins.
   * Subsequent definitions will be chained. These methods must return void.
   */
  DEFINE_MANY: null,
  /**
   * These methods are overriding the base class.
   */
  OVERRIDE_BASE: null,
  /**
   * These methods are similar to DEFINE_MANY, except we assume they return
   * objects. We try to merge the keys of the return values of all the mixed in
   * functions. If there is a key conflict we throw.
   */
  DEFINE_MANY_MERGED: null
});

var injectedMixins = [];

var warnedSetProps = false;
function warnSetProps() {
  if (!warnedSetProps) {
    warnedSetProps = true;
    "production" !== 'production' ? warning(false, 'setProps(...) and replaceProps(...) are deprecated. ' + 'Instead, call render again at the top level.') : undefined;
  }
}

/**
 * Composite components are higher-level components that compose other composite
 * or native components.
 *
 * To create a new type of `ReactClass`, pass a specification of
 * your new class to `React.createClass`. The only requirement of your class
 * specification is that you implement a `render` method.
 *
 *   var MyComponent = React.createClass({
 *     render: function() {
 *       return <div>Hello World</div>;
 *     }
 *   });
 *
 * The class specification supports a specific protocol of methods that have
 * special meaning (e.g. `render`). See `ReactClassInterface` for
 * more the comprehensive protocol. Any other properties and methods in the
 * class specification will be available on the prototype.
 *
 * @interface ReactClassInterface
 * @internal
 */
var ReactClassInterface = {

  /**
   * An array of Mixin objects to include when defining your component.
   *
   * @type {array}
   * @optional
   */
  mixins: SpecPolicy.DEFINE_MANY,

  /**
   * An object containing properties and methods that should be defined on
   * the component's constructor instead of its prototype (static methods).
   *
   * @type {object}
   * @optional
   */
  statics: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of prop types for this component.
   *
   * @type {object}
   * @optional
   */
  propTypes: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of context types for this component.
   *
   * @type {object}
   * @optional
   */
  contextTypes: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of context types this component sets for its children.
   *
   * @type {object}
   * @optional
   */
  childContextTypes: SpecPolicy.DEFINE_MANY,

  // ==== Definition methods ====

  /**
   * Invoked when the component is mounted. Values in the mapping will be set on
   * `this.props` if that prop is not specified (i.e. using an `in` check).
   *
   * This method is invoked before `getInitialState` and therefore cannot rely
   * on `this.state` or use `this.setState`.
   *
   * @return {object}
   * @optional
   */
  getDefaultProps: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * Invoked once before the component is mounted. The return value will be used
   * as the initial value of `this.state`.
   *
   *   getInitialState: function() {
   *     return {
   *       isOn: false,
   *       fooBaz: new BazFoo()
   *     }
   *   }
   *
   * @return {object}
   * @optional
   */
  getInitialState: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * @return {object}
   * @optional
   */
  getChildContext: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * Uses props from `this.props` and state from `this.state` to render the
   * structure of the component.
   *
   * No guarantees are made about when or how often this method is invoked, so
   * it must not have side effects.
   *
   *   render: function() {
   *     var name = this.props.name;
   *     return <div>Hello, {name}!</div>;
   *   }
   *
   * @return {ReactComponent}
   * @nosideeffects
   * @required
   */
  render: SpecPolicy.DEFINE_ONCE,

  // ==== Delegate methods ====

  /**
   * Invoked when the component is initially created and about to be mounted.
   * This may have side effects, but any external subscriptions or data created
   * by this method must be cleaned up in `componentWillUnmount`.
   *
   * @optional
   */
  componentWillMount: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component has been mounted and has a DOM representation.
   * However, there is no guarantee that the DOM node is in the document.
   *
   * Use this as an opportunity to operate on the DOM when the component has
   * been mounted (initialized and rendered) for the first time.
   *
   * @param {DOMElement} rootNode DOM element representing the component.
   * @optional
   */
  componentDidMount: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked before the component receives new props.
   *
   * Use this as an opportunity to react to a prop transition by updating the
   * state using `this.setState`. Current props are accessed via `this.props`.
   *
   *   componentWillReceiveProps: function(nextProps, nextContext) {
   *     this.setState({
   *       likesIncreasing: nextProps.likeCount > this.props.likeCount
   *     });
   *   }
   *
   * NOTE: There is no equivalent `componentWillReceiveState`. An incoming prop
   * transition may cause a state change, but the opposite is not true. If you
   * need it, you are probably looking for `componentWillUpdate`.
   *
   * @param {object} nextProps
   * @optional
   */
  componentWillReceiveProps: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked while deciding if the component should be updated as a result of
   * receiving new props, state and/or context.
   *
   * Use this as an opportunity to `return false` when you're certain that the
   * transition to the new props/state/context will not require a component
   * update.
   *
   *   shouldComponentUpdate: function(nextProps, nextState, nextContext) {
   *     return !equal(nextProps, this.props) ||
   *       !equal(nextState, this.state) ||
   *       !equal(nextContext, this.context);
   *   }
   *
   * @param {object} nextProps
   * @param {?object} nextState
   * @param {?object} nextContext
   * @return {boolean} True if the component should update.
   * @optional
   */
  shouldComponentUpdate: SpecPolicy.DEFINE_ONCE,

  /**
   * Invoked when the component is about to update due to a transition from
   * `this.props`, `this.state` and `this.context` to `nextProps`, `nextState`
   * and `nextContext`.
   *
   * Use this as an opportunity to perform preparation before an update occurs.
   *
   * NOTE: You **cannot** use `this.setState()` in this method.
   *
   * @param {object} nextProps
   * @param {?object} nextState
   * @param {?object} nextContext
   * @param {ReactReconcileTransaction} transaction
   * @optional
   */
  componentWillUpdate: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component's DOM representation has been updated.
   *
   * Use this as an opportunity to operate on the DOM when the component has
   * been updated.
   *
   * @param {object} prevProps
   * @param {?object} prevState
   * @param {?object} prevContext
   * @param {DOMElement} rootNode DOM element representing the component.
   * @optional
   */
  componentDidUpdate: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component is about to be removed from its parent and have
   * its DOM representation destroyed.
   *
   * Use this as an opportunity to deallocate any external resources.
   *
   * NOTE: There is no `componentDidUnmount` since your component will have been
   * destroyed by that point.
   *
   * @optional
   */
  componentWillUnmount: SpecPolicy.DEFINE_MANY,

  // ==== Advanced methods ====

  /**
   * Updates the component's currently mounted DOM representation.
   *
   * By default, this implements React's rendering and reconciliation algorithm.
   * Sophisticated clients may wish to override this.
   *
   * @param {ReactReconcileTransaction} transaction
   * @internal
   * @overridable
   */
  updateComponent: SpecPolicy.OVERRIDE_BASE

};

/**
 * Mapping from class specification keys to special processing functions.
 *
 * Although these are declared like instance properties in the specification
 * when defining classes using `React.createClass`, they are actually static
 * and are accessible on the constructor instead of the prototype. Despite
 * being static, they must be defined outside of the "statics" key under
 * which all other static methods are defined.
 */
var RESERVED_SPEC_KEYS = {
  displayName: function (Constructor, displayName) {
    Constructor.displayName = displayName;
  },
  mixins: function (Constructor, mixins) {
    if (mixins) {
      for (var i = 0; i < mixins.length; i++) {
        mixSpecIntoComponent(Constructor, mixins[i]);
      }
    }
  },
  childContextTypes: function (Constructor, childContextTypes) {
    if ("production" !== 'production') {
      validateTypeDef(Constructor, childContextTypes, ReactPropTypeLocations.childContext);
    }
    Constructor.childContextTypes = assign({}, Constructor.childContextTypes, childContextTypes);
  },
  contextTypes: function (Constructor, contextTypes) {
    if ("production" !== 'production') {
      validateTypeDef(Constructor, contextTypes, ReactPropTypeLocations.context);
    }
    Constructor.contextTypes = assign({}, Constructor.contextTypes, contextTypes);
  },
  /**
   * Special case getDefaultProps which should move into statics but requires
   * automatic merging.
   */
  getDefaultProps: function (Constructor, getDefaultProps) {
    if (Constructor.getDefaultProps) {
      Constructor.getDefaultProps = createMergedResultFunction(Constructor.getDefaultProps, getDefaultProps);
    } else {
      Constructor.getDefaultProps = getDefaultProps;
    }
  },
  propTypes: function (Constructor, propTypes) {
    if ("production" !== 'production') {
      validateTypeDef(Constructor, propTypes, ReactPropTypeLocations.prop);
    }
    Constructor.propTypes = assign({}, Constructor.propTypes, propTypes);
  },
  statics: function (Constructor, statics) {
    mixStaticSpecIntoComponent(Constructor, statics);
  },
  autobind: function () {} };

// noop
function validateTypeDef(Constructor, typeDef, location) {
  for (var propName in typeDef) {
    if (typeDef.hasOwnProperty(propName)) {
      // use a warning instead of an invariant so components
      // don't show up in prod but not in __DEV__
      "production" !== 'production' ? warning(typeof typeDef[propName] === 'function', '%s: %s type `%s` is invalid; it must be a function, usually from ' + 'React.PropTypes.', Constructor.displayName || 'ReactClass', ReactPropTypeLocationNames[location], propName) : undefined;
    }
  }
}

function validateMethodOverride(proto, name) {
  var specPolicy = ReactClassInterface.hasOwnProperty(name) ? ReactClassInterface[name] : null;

  // Disallow overriding of base class methods unless explicitly allowed.
  if (ReactClassMixin.hasOwnProperty(name)) {
    !(specPolicy === SpecPolicy.OVERRIDE_BASE) ? "production" !== 'production' ? invariant(false, 'ReactClassInterface: You are attempting to override ' + '`%s` from your class specification. Ensure that your method names ' + 'do not overlap with React methods.', name) : invariant(false) : undefined;
  }

  // Disallow defining methods more than once unless explicitly allowed.
  if (proto.hasOwnProperty(name)) {
    !(specPolicy === SpecPolicy.DEFINE_MANY || specPolicy === SpecPolicy.DEFINE_MANY_MERGED) ? "production" !== 'production' ? invariant(false, 'ReactClassInterface: You are attempting to define ' + '`%s` on your component more than once. This conflict may be due ' + 'to a mixin.', name) : invariant(false) : undefined;
  }
}

/**
 * Mixin helper which handles policy validation and reserved
 * specification keys when building React classses.
 */
function mixSpecIntoComponent(Constructor, spec) {
  if (!spec) {
    return;
  }

  !(typeof spec !== 'function') ? "production" !== 'production' ? invariant(false, 'ReactClass: You\'re attempting to ' + 'use a component class as a mixin. Instead, just use a regular object.') : invariant(false) : undefined;
  !!ReactElement.isValidElement(spec) ? "production" !== 'production' ? invariant(false, 'ReactClass: You\'re attempting to ' + 'use a component as a mixin. Instead, just use a regular object.') : invariant(false) : undefined;

  var proto = Constructor.prototype;

  // By handling mixins before any other properties, we ensure the same
  // chaining order is applied to methods with DEFINE_MANY policy, whether
  // mixins are listed before or after these methods in the spec.
  if (spec.hasOwnProperty(MIXINS_KEY)) {
    RESERVED_SPEC_KEYS.mixins(Constructor, spec.mixins);
  }

  for (var name in spec) {
    if (!spec.hasOwnProperty(name)) {
      continue;
    }

    if (name === MIXINS_KEY) {
      // We have already handled mixins in a special case above.
      continue;
    }

    var property = spec[name];
    validateMethodOverride(proto, name);

    if (RESERVED_SPEC_KEYS.hasOwnProperty(name)) {
      RESERVED_SPEC_KEYS[name](Constructor, property);
    } else {
      // Setup methods on prototype:
      // The following member methods should not be automatically bound:
      // 1. Expected ReactClass methods (in the "interface").
      // 2. Overridden methods (that were mixed in).
      var isReactClassMethod = ReactClassInterface.hasOwnProperty(name);
      var isAlreadyDefined = proto.hasOwnProperty(name);
      var isFunction = typeof property === 'function';
      var shouldAutoBind = isFunction && !isReactClassMethod && !isAlreadyDefined && spec.autobind !== false;

      if (shouldAutoBind) {
        if (!proto.__reactAutoBindMap) {
          proto.__reactAutoBindMap = {};
        }
        proto.__reactAutoBindMap[name] = property;
        proto[name] = property;
      } else {
        if (isAlreadyDefined) {
          var specPolicy = ReactClassInterface[name];

          // These cases should already be caught by validateMethodOverride.
          !(isReactClassMethod && (specPolicy === SpecPolicy.DEFINE_MANY_MERGED || specPolicy === SpecPolicy.DEFINE_MANY)) ? "production" !== 'production' ? invariant(false, 'ReactClass: Unexpected spec policy %s for key %s ' + 'when mixing in component specs.', specPolicy, name) : invariant(false) : undefined;

          // For methods which are defined more than once, call the existing
          // methods before calling the new property, merging if appropriate.
          if (specPolicy === SpecPolicy.DEFINE_MANY_MERGED) {
            proto[name] = createMergedResultFunction(proto[name], property);
          } else if (specPolicy === SpecPolicy.DEFINE_MANY) {
            proto[name] = createChainedFunction(proto[name], property);
          }
        } else {
          proto[name] = property;
          if ("production" !== 'production') {
            // Add verbose displayName to the function, which helps when looking
            // at profiling tools.
            if (typeof property === 'function' && spec.displayName) {
              proto[name].displayName = spec.displayName + '_' + name;
            }
          }
        }
      }
    }
  }
}

function mixStaticSpecIntoComponent(Constructor, statics) {
  if (!statics) {
    return;
  }
  for (var name in statics) {
    var property = statics[name];
    if (!statics.hasOwnProperty(name)) {
      continue;
    }

    var isReserved = (name in RESERVED_SPEC_KEYS);
    !!isReserved ? "production" !== 'production' ? invariant(false, 'ReactClass: You are attempting to define a reserved ' + 'property, `%s`, that shouldn\'t be on the "statics" key. Define it ' + 'as an instance property instead; it will still be accessible on the ' + 'constructor.', name) : invariant(false) : undefined;

    var isInherited = (name in Constructor);
    !!isInherited ? "production" !== 'production' ? invariant(false, 'ReactClass: You are attempting to define ' + '`%s` on your component more than once. This conflict may be ' + 'due to a mixin.', name) : invariant(false) : undefined;
    Constructor[name] = property;
  }
}

/**
 * Merge two objects, but throw if both contain the same key.
 *
 * @param {object} one The first object, which is mutated.
 * @param {object} two The second object
 * @return {object} one after it has been mutated to contain everything in two.
 */
function mergeIntoWithNoDuplicateKeys(one, two) {
  !(one && two && typeof one === 'object' && typeof two === 'object') ? "production" !== 'production' ? invariant(false, 'mergeIntoWithNoDuplicateKeys(): Cannot merge non-objects.') : invariant(false) : undefined;

  for (var key in two) {
    if (two.hasOwnProperty(key)) {
      !(one[key] === undefined) ? "production" !== 'production' ? invariant(false, 'mergeIntoWithNoDuplicateKeys(): ' + 'Tried to merge two objects with the same key: `%s`. This conflict ' + 'may be due to a mixin; in particular, this may be caused by two ' + 'getInitialState() or getDefaultProps() methods returning objects ' + 'with clashing keys.', key) : invariant(false) : undefined;
      one[key] = two[key];
    }
  }
  return one;
}

/**
 * Creates a function that invokes two functions and merges their return values.
 *
 * @param {function} one Function to invoke first.
 * @param {function} two Function to invoke second.
 * @return {function} Function that invokes the two argument functions.
 * @private
 */
function createMergedResultFunction(one, two) {
  return function mergedResult() {
    var a = one.apply(this, arguments);
    var b = two.apply(this, arguments);
    if (a == null) {
      return b;
    } else if (b == null) {
      return a;
    }
    var c = {};
    mergeIntoWithNoDuplicateKeys(c, a);
    mergeIntoWithNoDuplicateKeys(c, b);
    return c;
  };
}

/**
 * Creates a function that invokes two functions and ignores their return vales.
 *
 * @param {function} one Function to invoke first.
 * @param {function} two Function to invoke second.
 * @return {function} Function that invokes the two argument functions.
 * @private
 */
function createChainedFunction(one, two) {
  return function chainedFunction() {
    one.apply(this, arguments);
    two.apply(this, arguments);
  };
}

/**
 * Binds a method to the component.
 *
 * @param {object} component Component whose method is going to be bound.
 * @param {function} method Method to be bound.
 * @return {function} The bound method.
 */
function bindAutoBindMethod(component, method) {
  var boundMethod = method.bind(component);
  if ("production" !== 'production') {
    boundMethod.__reactBoundContext = component;
    boundMethod.__reactBoundMethod = method;
    boundMethod.__reactBoundArguments = null;
    var componentName = component.constructor.displayName;
    var _bind = boundMethod.bind;
    /* eslint-disable block-scoped-var, no-undef */
    boundMethod.bind = function (newThis) {
      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      // User is trying to bind() an autobound method; we effectively will
      // ignore the value of "this" that the user is trying to use, so
      // let's warn.
      if (newThis !== component && newThis !== null) {
        "production" !== 'production' ? warning(false, 'bind(): React component methods may only be bound to the ' + 'component instance. See %s', componentName) : undefined;
      } else if (!args.length) {
        "production" !== 'production' ? warning(false, 'bind(): You are binding a component method to the component. ' + 'React does this for you automatically in a high-performance ' + 'way, so you can safely remove this call. See %s', componentName) : undefined;
        return boundMethod;
      }
      var reboundMethod = _bind.apply(boundMethod, arguments);
      reboundMethod.__reactBoundContext = component;
      reboundMethod.__reactBoundMethod = method;
      reboundMethod.__reactBoundArguments = args;
      return reboundMethod;
      /* eslint-enable */
    };
  }
  return boundMethod;
}

/**
 * Binds all auto-bound methods in a component.
 *
 * @param {object} component Component whose method is going to be bound.
 */
function bindAutoBindMethods(component) {
  for (var autoBindKey in component.__reactAutoBindMap) {
    if (component.__reactAutoBindMap.hasOwnProperty(autoBindKey)) {
      var method = component.__reactAutoBindMap[autoBindKey];
      component[autoBindKey] = bindAutoBindMethod(component, method);
    }
  }
}

/**
 * Add more to the ReactClass base class. These are all legacy features and
 * therefore not already part of the modern ReactComponent.
 */
var ReactClassMixin = {

  /**
   * TODO: This will be deprecated because state should always keep a consistent
   * type signature and the only use case for this, is to avoid that.
   */
  replaceState: function (newState, callback) {
    this.updater.enqueueReplaceState(this, newState);
    if (callback) {
      this.updater.enqueueCallback(this, callback);
    }
  },

  /**
   * Checks whether or not this composite component is mounted.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  isMounted: function () {
    return this.updater.isMounted(this);
  },

  /**
   * Sets a subset of the props.
   *
   * @param {object} partialProps Subset of the next props.
   * @param {?function} callback Called after props are updated.
   * @final
   * @public
   * @deprecated
   */
  setProps: function (partialProps, callback) {
    if ("production" !== 'production') {
      warnSetProps();
    }
    this.updater.enqueueSetProps(this, partialProps);
    if (callback) {
      this.updater.enqueueCallback(this, callback);
    }
  },

  /**
   * Replace all the props.
   *
   * @param {object} newProps Subset of the next props.
   * @param {?function} callback Called after props are updated.
   * @final
   * @public
   * @deprecated
   */
  replaceProps: function (newProps, callback) {
    if ("production" !== 'production') {
      warnSetProps();
    }
    this.updater.enqueueReplaceProps(this, newProps);
    if (callback) {
      this.updater.enqueueCallback(this, callback);
    }
  }
};

var ReactClassComponent = function () {};
assign(ReactClassComponent.prototype, ReactComponent.prototype, ReactClassMixin);

/**
 * Module for creating composite components.
 *
 * @class ReactClass
 */
var ReactClass = {

  /**
   * Creates a composite component class given a class specification.
   *
   * @param {object} spec Class specification (which must define `render`).
   * @return {function} Component constructor function.
   * @public
   */
  createClass: function (spec) {
    var Constructor = function (props, context, updater) {
      // This constructor is overridden by mocks. The argument is used
      // by mocks to assert on what gets mounted.

      if ("production" !== 'production') {
        "production" !== 'production' ? warning(this instanceof Constructor, 'Something is calling a React component directly. Use a factory or ' + 'JSX instead. See: https://fb.me/react-legacyfactory') : undefined;
      }

      // Wire up auto-binding
      if (this.__reactAutoBindMap) {
        bindAutoBindMethods(this);
      }

      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;

      this.state = null;

      // ReactClasses doesn't have constructors. Instead, they use the
      // getInitialState and componentWillMount methods for initialization.

      var initialState = this.getInitialState ? this.getInitialState() : null;
      if ("production" !== 'production') {
        // We allow auto-mocks to proceed as if they're returning null.
        if (typeof initialState === 'undefined' && this.getInitialState._isMockFunction) {
          // This is probably bad practice. Consider warning here and
          // deprecating this convenience.
          initialState = null;
        }
      }
      !(typeof initialState === 'object' && !Array.isArray(initialState)) ? "production" !== 'production' ? invariant(false, '%s.getInitialState(): must return an object or null', Constructor.displayName || 'ReactCompositeComponent') : invariant(false) : undefined;

      this.state = initialState;
    };
    Constructor.prototype = new ReactClassComponent();
    Constructor.prototype.constructor = Constructor;

    injectedMixins.forEach(mixSpecIntoComponent.bind(null, Constructor));

    mixSpecIntoComponent(Constructor, spec);

    // Initialize the defaultProps property after all mixins have been merged.
    if (Constructor.getDefaultProps) {
      Constructor.defaultProps = Constructor.getDefaultProps();
    }

    if ("production" !== 'production') {
      // This is a tag to indicate that the use of these method names is ok,
      // since it's used with createClass. If it's not, then it's likely a
      // mistake so we'll warn you to use the static property, property
      // initializer or constructor respectively.
      if (Constructor.getDefaultProps) {
        Constructor.getDefaultProps.isReactClassApproved = {};
      }
      if (Constructor.prototype.getInitialState) {
        Constructor.prototype.getInitialState.isReactClassApproved = {};
      }
    }

    !Constructor.prototype.render ? "production" !== 'production' ? invariant(false, 'createClass(...): Class specification must implement a `render` method.') : invariant(false) : undefined;

    if ("production" !== 'production') {
      "production" !== 'production' ? warning(!Constructor.prototype.componentShouldUpdate, '%s has a method called ' + 'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' + 'The name is phrased as a question because the function is ' + 'expected to return a value.', spec.displayName || 'A component') : undefined;
      "production" !== 'production' ? warning(!Constructor.prototype.componentWillRecieveProps, '%s has a method called ' + 'componentWillRecieveProps(). Did you mean componentWillReceiveProps()?', spec.displayName || 'A component') : undefined;
    }

    // Reduce time spent doing lookups by setting these on the prototype.
    for (var methodName in ReactClassInterface) {
      if (!Constructor.prototype[methodName]) {
        Constructor.prototype[methodName] = null;
      }
    }

    return Constructor;
  },

  injection: {
    injectMixin: function (mixin) {
      injectedMixins.push(mixin);
    }
  }

};

module.exports = ReactClass;
},{"./Object.assign":78,"./ReactComponent":86,"./ReactElement":108,"./ReactNoopUpdateQueue":125,"./ReactPropTypeLocationNames":128,"./ReactPropTypeLocations":129,"fbjs/lib/emptyObject":193,"fbjs/lib/invariant":200,"fbjs/lib/keyMirror":203,"fbjs/lib/keyOf":204,"fbjs/lib/warning":211}],86:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactComponent
 */

'use strict';

var ReactNoopUpdateQueue = require('./ReactNoopUpdateQueue');

var canDefineProperty = require('./canDefineProperty');
var emptyObject = require('fbjs/lib/emptyObject');
var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

/**
 * Base class helpers for the updating state of a component.
 */
function ReactComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  // We initialize the default updater but the real one gets injected by the
  // renderer.
  this.updater = updater || ReactNoopUpdateQueue;
}

ReactComponent.prototype.isReactComponent = {};

/**
 * Sets a subset of the state. Always use this to mutate
 * state. You should treat `this.state` as immutable.
 *
 * There is no guarantee that `this.state` will be immediately updated, so
 * accessing `this.state` after calling this method may return the old value.
 *
 * There is no guarantee that calls to `setState` will run synchronously,
 * as they may eventually be batched together.  You can provide an optional
 * callback that will be executed when the call to setState is actually
 * completed.
 *
 * When a function is provided to setState, it will be called at some point in
 * the future (not synchronously). It will be called with the up to date
 * component arguments (state, props, context). These values can be different
 * from this.* because your function may be called after receiveProps but before
 * shouldComponentUpdate, and this new state, props, and context will not yet be
 * assigned to this.
 *
 * @param {object|function} partialState Next partial state or function to
 *        produce next partial state to be merged with current state.
 * @param {?function} callback Called after state is updated.
 * @final
 * @protected
 */
ReactComponent.prototype.setState = function (partialState, callback) {
  !(typeof partialState === 'object' || typeof partialState === 'function' || partialState == null) ? "production" !== 'production' ? invariant(false, 'setState(...): takes an object of state variables to update or a ' + 'function which returns an object of state variables.') : invariant(false) : undefined;
  if ("production" !== 'production') {
    "production" !== 'production' ? warning(partialState != null, 'setState(...): You passed an undefined or null state object; ' + 'instead, use forceUpdate().') : undefined;
  }
  this.updater.enqueueSetState(this, partialState);
  if (callback) {
    this.updater.enqueueCallback(this, callback);
  }
};

/**
 * Forces an update. This should only be invoked when it is known with
 * certainty that we are **not** in a DOM transaction.
 *
 * You may want to call this when you know that some deeper aspect of the
 * component's state has changed but `setState` was not called.
 *
 * This will not invoke `shouldComponentUpdate`, but it will invoke
 * `componentWillUpdate` and `componentDidUpdate`.
 *
 * @param {?function} callback Called after update is complete.
 * @final
 * @protected
 */
ReactComponent.prototype.forceUpdate = function (callback) {
  this.updater.enqueueForceUpdate(this);
  if (callback) {
    this.updater.enqueueCallback(this, callback);
  }
};

/**
 * Deprecated APIs. These APIs used to exist on classic React classes but since
 * we would like to deprecate them, we're not going to move them over to this
 * modern base class. Instead, we define a getter that warns if it's accessed.
 */
if ("production" !== 'production') {
  var deprecatedAPIs = {
    getDOMNode: ['getDOMNode', 'Use ReactDOM.findDOMNode(component) instead.'],
    isMounted: ['isMounted', 'Instead, make sure to clean up subscriptions and pending requests in ' + 'componentWillUnmount to prevent memory leaks.'],
    replaceProps: ['replaceProps', 'Instead, call render again at the top level.'],
    replaceState: ['replaceState', 'Refactor your code to use setState instead (see ' + 'https://github.com/facebook/react/issues/3236).'],
    setProps: ['setProps', 'Instead, call render again at the top level.']
  };
  var defineDeprecationWarning = function (methodName, info) {
    if (canDefineProperty) {
      Object.defineProperty(ReactComponent.prototype, methodName, {
        get: function () {
          "production" !== 'production' ? warning(false, '%s(...) is deprecated in plain JavaScript React classes. %s', info[0], info[1]) : undefined;
          return undefined;
        }
      });
    }
  };
  for (var fnName in deprecatedAPIs) {
    if (deprecatedAPIs.hasOwnProperty(fnName)) {
      defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
    }
  }
}

module.exports = ReactComponent;
},{"./ReactNoopUpdateQueue":125,"./canDefineProperty":160,"fbjs/lib/emptyObject":193,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],87:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactComponentBrowserEnvironment
 */

'use strict';

var ReactDOMIDOperations = require('./ReactDOMIDOperations');
var ReactMount = require('./ReactMount');

/**
 * Abstracts away all functionality of the reconciler that requires knowledge of
 * the browser context. TODO: These callers should be refactored to avoid the
 * need for this injection.
 */
var ReactComponentBrowserEnvironment = {

  processChildrenUpdates: ReactDOMIDOperations.dangerouslyProcessChildrenUpdates,

  replaceNodeWithMarkupByID: ReactDOMIDOperations.dangerouslyReplaceNodeWithMarkupByID,

  /**
   * If a particular environment requires that some resources be cleaned up,
   * specify this in the injected Mixin. In the DOM, we would likely want to
   * purge any cached node ID lookups.
   *
   * @private
   */
  unmountIDFromEnvironment: function (rootNodeID) {
    ReactMount.purgeID(rootNodeID);
  }

};

module.exports = ReactComponentBrowserEnvironment;
},{"./ReactDOMIDOperations":96,"./ReactMount":121}],88:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactComponentEnvironment
 */

'use strict';

var invariant = require('fbjs/lib/invariant');

var injected = false;

var ReactComponentEnvironment = {

  /**
   * Optionally injectable environment dependent cleanup hook. (server vs.
   * browser etc). Example: A browser system caches DOM nodes based on component
   * ID and must remove that cache entry when this instance is unmounted.
   */
  unmountIDFromEnvironment: null,

  /**
   * Optionally injectable hook for swapping out mount images in the middle of
   * the tree.
   */
  replaceNodeWithMarkupByID: null,

  /**
   * Optionally injectable hook for processing a queue of child updates. Will
   * later move into MultiChildComponents.
   */
  processChildrenUpdates: null,

  injection: {
    injectEnvironment: function (environment) {
      !!injected ? "production" !== 'production' ? invariant(false, 'ReactCompositeComponent: injectEnvironment() can only be called once.') : invariant(false) : undefined;
      ReactComponentEnvironment.unmountIDFromEnvironment = environment.unmountIDFromEnvironment;
      ReactComponentEnvironment.replaceNodeWithMarkupByID = environment.replaceNodeWithMarkupByID;
      ReactComponentEnvironment.processChildrenUpdates = environment.processChildrenUpdates;
      injected = true;
    }
  }

};

module.exports = ReactComponentEnvironment;
},{"fbjs/lib/invariant":200}],89:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactCompositeComponent
 */

'use strict';

var ReactComponentEnvironment = require('./ReactComponentEnvironment');
var ReactCurrentOwner = require('./ReactCurrentOwner');
var ReactElement = require('./ReactElement');
var ReactInstanceMap = require('./ReactInstanceMap');
var ReactPerf = require('./ReactPerf');
var ReactPropTypeLocations = require('./ReactPropTypeLocations');
var ReactPropTypeLocationNames = require('./ReactPropTypeLocationNames');
var ReactReconciler = require('./ReactReconciler');
var ReactUpdateQueue = require('./ReactUpdateQueue');

var assign = require('./Object.assign');
var emptyObject = require('fbjs/lib/emptyObject');
var invariant = require('fbjs/lib/invariant');
var shouldUpdateReactComponent = require('./shouldUpdateReactComponent');
var warning = require('fbjs/lib/warning');

function getDeclarationErrorAddendum(component) {
  var owner = component._currentElement._owner || null;
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

function StatelessComponent(Component) {}
StatelessComponent.prototype.render = function () {
  var Component = ReactInstanceMap.get(this)._currentElement.type;
  return Component(this.props, this.context, this.updater);
};

/**
 * ------------------ The Life-Cycle of a Composite Component ------------------
 *
 * - constructor: Initialization of state. The instance is now retained.
 *   - componentWillMount
 *   - render
 *   - [children's constructors]
 *     - [children's componentWillMount and render]
 *     - [children's componentDidMount]
 *     - componentDidMount
 *
 *       Update Phases:
 *       - componentWillReceiveProps (only called if parent updated)
 *       - shouldComponentUpdate
 *         - componentWillUpdate
 *           - render
 *           - [children's constructors or receive props phases]
 *         - componentDidUpdate
 *
 *     - componentWillUnmount
 *     - [children's componentWillUnmount]
 *   - [children destroyed]
 * - (destroyed): The instance is now blank, released by React and ready for GC.
 *
 * -----------------------------------------------------------------------------
 */

/**
 * An incrementing ID assigned to each component when it is mounted. This is
 * used to enforce the order in which `ReactUpdates` updates dirty components.
 *
 * @private
 */
var nextMountID = 1;

/**
 * @lends {ReactCompositeComponent.prototype}
 */
var ReactCompositeComponentMixin = {

  /**
   * Base constructor for all composite component.
   *
   * @param {ReactElement} element
   * @final
   * @internal
   */
  construct: function (element) {
    this._currentElement = element;
    this._rootNodeID = null;
    this._instance = null;

    // See ReactUpdateQueue
    this._pendingElement = null;
    this._pendingStateQueue = null;
    this._pendingReplaceState = false;
    this._pendingForceUpdate = false;

    this._renderedComponent = null;

    this._context = null;
    this._mountOrder = 0;
    this._topLevelWrapper = null;

    // See ReactUpdates and ReactUpdateQueue.
    this._pendingCallbacks = null;
  },

  /**
   * Initializes the component, renders markup, and registers event listeners.
   *
   * @param {string} rootID DOM ID of the root node.
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @return {?string} Rendered markup to be inserted into the DOM.
   * @final
   * @internal
   */
  mountComponent: function (rootID, transaction, context) {
    this._context = context;
    this._mountOrder = nextMountID++;
    this._rootNodeID = rootID;

    var publicProps = this._processProps(this._currentElement.props);
    var publicContext = this._processContext(context);

    var Component = this._currentElement.type;

    // Initialize the public class
    var inst;
    var renderedElement;

    // This is a way to detect if Component is a stateless arrow function
    // component, which is not newable. It might not be 100% reliable but is
    // something we can do until we start detecting that Component extends
    // React.Component. We already assume that typeof Component === 'function'.
    var canInstantiate = ('prototype' in Component);

    if (canInstantiate) {
      if ("production" !== 'production') {
        ReactCurrentOwner.current = this;
        try {
          inst = new Component(publicProps, publicContext, ReactUpdateQueue);
        } finally {
          ReactCurrentOwner.current = null;
        }
      } else {
        inst = new Component(publicProps, publicContext, ReactUpdateQueue);
      }
    }

    if (!canInstantiate || inst === null || inst === false || ReactElement.isValidElement(inst)) {
      renderedElement = inst;
      inst = new StatelessComponent(Component);
    }

    if ("production" !== 'production') {
      // This will throw later in _renderValidatedComponent, but add an early
      // warning now to help debugging
      if (inst.render == null) {
        "production" !== 'production' ? warning(false, '%s(...): No `render` method found on the returned component ' + 'instance: you may have forgotten to define `render`, returned ' + 'null/false from a stateless component, or tried to render an ' + 'element whose type is a function that isn\'t a React component.', Component.displayName || Component.name || 'Component') : undefined;
      } else {
        // We support ES6 inheriting from React.Component, the module pattern,
        // and stateless components, but not ES6 classes that don't extend
        "production" !== 'production' ? warning(Component.prototype && Component.prototype.isReactComponent || !canInstantiate || !(inst instanceof Component), '%s(...): React component classes must extend React.Component.', Component.displayName || Component.name || 'Component') : undefined;
      }
    }

    // These should be set up in the constructor, but as a convenience for
    // simpler class abstractions, we set them up after the fact.
    inst.props = publicProps;
    inst.context = publicContext;
    inst.refs = emptyObject;
    inst.updater = ReactUpdateQueue;

    this._instance = inst;

    // Store a reference from the instance back to the internal representation
    ReactInstanceMap.set(inst, this);

    if ("production" !== 'production') {
      // Since plain JS classes are defined without any special initialization
      // logic, we can not catch common errors early. Therefore, we have to
      // catch them here, at initialization time, instead.
      "production" !== 'production' ? warning(!inst.getInitialState || inst.getInitialState.isReactClassApproved, 'getInitialState was defined on %s, a plain JavaScript class. ' + 'This is only supported for classes created using React.createClass. ' + 'Did you mean to define a state property instead?', this.getName() || 'a component') : undefined;
      "production" !== 'production' ? warning(!inst.getDefaultProps || inst.getDefaultProps.isReactClassApproved, 'getDefaultProps was defined on %s, a plain JavaScript class. ' + 'This is only supported for classes created using React.createClass. ' + 'Use a static property to define defaultProps instead.', this.getName() || 'a component') : undefined;
      "production" !== 'production' ? warning(!inst.propTypes, 'propTypes was defined as an instance property on %s. Use a static ' + 'property to define propTypes instead.', this.getName() || 'a component') : undefined;
      "production" !== 'production' ? warning(!inst.contextTypes, 'contextTypes was defined as an instance property on %s. Use a ' + 'static property to define contextTypes instead.', this.getName() || 'a component') : undefined;
      "production" !== 'production' ? warning(typeof inst.componentShouldUpdate !== 'function', '%s has a method called ' + 'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' + 'The name is phrased as a question because the function is ' + 'expected to return a value.', this.getName() || 'A component') : undefined;
      "production" !== 'production' ? warning(typeof inst.componentDidUnmount !== 'function', '%s has a method called ' + 'componentDidUnmount(). But there is no such lifecycle method. ' + 'Did you mean componentWillUnmount()?', this.getName() || 'A component') : undefined;
      "production" !== 'production' ? warning(typeof inst.componentWillRecieveProps !== 'function', '%s has a method called ' + 'componentWillRecieveProps(). Did you mean componentWillReceiveProps()?', this.getName() || 'A component') : undefined;
    }

    var initialState = inst.state;
    if (initialState === undefined) {
      inst.state = initialState = null;
    }
    !(typeof initialState === 'object' && !Array.isArray(initialState)) ? "production" !== 'production' ? invariant(false, '%s.state: must be set to an object or null', this.getName() || 'ReactCompositeComponent') : invariant(false) : undefined;

    this._pendingStateQueue = null;
    this._pendingReplaceState = false;
    this._pendingForceUpdate = false;

    if (inst.componentWillMount) {
      inst.componentWillMount();
      // When mounting, calls to `setState` by `componentWillMount` will set
      // `this._pendingStateQueue` without triggering a re-render.
      if (this._pendingStateQueue) {
        inst.state = this._processPendingState(inst.props, inst.context);
      }
    }

    // If not a stateless component, we now render
    if (renderedElement === undefined) {
      renderedElement = this._renderValidatedComponent();
    }

    this._renderedComponent = this._instantiateReactComponent(renderedElement);

    var markup = ReactReconciler.mountComponent(this._renderedComponent, rootID, transaction, this._processChildContext(context));
    if (inst.componentDidMount) {
      transaction.getReactMountReady().enqueue(inst.componentDidMount, inst);
    }

    return markup;
  },

  /**
   * Releases any resources allocated by `mountComponent`.
   *
   * @final
   * @internal
   */
  unmountComponent: function () {
    var inst = this._instance;

    if (inst.componentWillUnmount) {
      inst.componentWillUnmount();
    }

    ReactReconciler.unmountComponent(this._renderedComponent);
    this._renderedComponent = null;
    this._instance = null;

    // Reset pending fields
    // Even if this component is scheduled for another update in ReactUpdates,
    // it would still be ignored because these fields are reset.
    this._pendingStateQueue = null;
    this._pendingReplaceState = false;
    this._pendingForceUpdate = false;
    this._pendingCallbacks = null;
    this._pendingElement = null;

    // These fields do not really need to be reset since this object is no
    // longer accessible.
    this._context = null;
    this._rootNodeID = null;
    this._topLevelWrapper = null;

    // Delete the reference from the instance to this internal representation
    // which allow the internals to be properly cleaned up even if the user
    // leaks a reference to the public instance.
    ReactInstanceMap.remove(inst);

    // Some existing components rely on inst.props even after they've been
    // destroyed (in event handlers).
    // TODO: inst.props = null;
    // TODO: inst.state = null;
    // TODO: inst.context = null;
  },

  /**
   * Filters the context object to only contain keys specified in
   * `contextTypes`
   *
   * @param {object} context
   * @return {?object}
   * @private
   */
  _maskContext: function (context) {
    var maskedContext = null;
    var Component = this._currentElement.type;
    var contextTypes = Component.contextTypes;
    if (!contextTypes) {
      return emptyObject;
    }
    maskedContext = {};
    for (var contextName in contextTypes) {
      maskedContext[contextName] = context[contextName];
    }
    return maskedContext;
  },

  /**
   * Filters the context object to only contain keys specified in
   * `contextTypes`, and asserts that they are valid.
   *
   * @param {object} context
   * @return {?object}
   * @private
   */
  _processContext: function (context) {
    var maskedContext = this._maskContext(context);
    if ("production" !== 'production') {
      var Component = this._currentElement.type;
      if (Component.contextTypes) {
        this._checkPropTypes(Component.contextTypes, maskedContext, ReactPropTypeLocations.context);
      }
    }
    return maskedContext;
  },

  /**
   * @param {object} currentContext
   * @return {object}
   * @private
   */
  _processChildContext: function (currentContext) {
    var Component = this._currentElement.type;
    var inst = this._instance;
    var childContext = inst.getChildContext && inst.getChildContext();
    if (childContext) {
      !(typeof Component.childContextTypes === 'object') ? "production" !== 'production' ? invariant(false, '%s.getChildContext(): childContextTypes must be defined in order to ' + 'use getChildContext().', this.getName() || 'ReactCompositeComponent') : invariant(false) : undefined;
      if ("production" !== 'production') {
        this._checkPropTypes(Component.childContextTypes, childContext, ReactPropTypeLocations.childContext);
      }
      for (var name in childContext) {
        !(name in Component.childContextTypes) ? "production" !== 'production' ? invariant(false, '%s.getChildContext(): key "%s" is not defined in childContextTypes.', this.getName() || 'ReactCompositeComponent', name) : invariant(false) : undefined;
      }
      return assign({}, currentContext, childContext);
    }
    return currentContext;
  },

  /**
   * Processes props by setting default values for unspecified props and
   * asserting that the props are valid. Does not mutate its argument; returns
   * a new props object with defaults merged in.
   *
   * @param {object} newProps
   * @return {object}
   * @private
   */
  _processProps: function (newProps) {
    if ("production" !== 'production') {
      var Component = this._currentElement.type;
      if (Component.propTypes) {
        this._checkPropTypes(Component.propTypes, newProps, ReactPropTypeLocations.prop);
      }
    }
    return newProps;
  },

  /**
   * Assert that the props are valid
   *
   * @param {object} propTypes Map of prop name to a ReactPropType
   * @param {object} props
   * @param {string} location e.g. "prop", "context", "child context"
   * @private
   */
  _checkPropTypes: function (propTypes, props, location) {
    // TODO: Stop validating prop types here and only use the element
    // validation.
    var componentName = this.getName();
    for (var propName in propTypes) {
      if (propTypes.hasOwnProperty(propName)) {
        var error;
        try {
          // This is intentionally an invariant that gets caught. It's the same
          // behavior as without this statement except with a better message.
          !(typeof propTypes[propName] === 'function') ? "production" !== 'production' ? invariant(false, '%s: %s type `%s` is invalid; it must be a function, usually ' + 'from React.PropTypes.', componentName || 'React class', ReactPropTypeLocationNames[location], propName) : invariant(false) : undefined;
          error = propTypes[propName](props, propName, componentName, location);
        } catch (ex) {
          error = ex;
        }
        if (error instanceof Error) {
          // We may want to extend this logic for similar errors in
          // top-level render calls, so I'm abstracting it away into
          // a function to minimize refactoring in the future
          var addendum = getDeclarationErrorAddendum(this);

          if (location === ReactPropTypeLocations.prop) {
            // Preface gives us something to blacklist in warning module
            "production" !== 'production' ? warning(false, 'Failed Composite propType: %s%s', error.message, addendum) : undefined;
          } else {
            "production" !== 'production' ? warning(false, 'Failed Context Types: %s%s', error.message, addendum) : undefined;
          }
        }
      }
    }
  },

  receiveComponent: function (nextElement, transaction, nextContext) {
    var prevElement = this._currentElement;
    var prevContext = this._context;

    this._pendingElement = null;

    this.updateComponent(transaction, prevElement, nextElement, prevContext, nextContext);
  },

  /**
   * If any of `_pendingElement`, `_pendingStateQueue`, or `_pendingForceUpdate`
   * is set, update the component.
   *
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  performUpdateIfNecessary: function (transaction) {
    if (this._pendingElement != null) {
      ReactReconciler.receiveComponent(this, this._pendingElement || this._currentElement, transaction, this._context);
    }

    if (this._pendingStateQueue !== null || this._pendingForceUpdate) {
      this.updateComponent(transaction, this._currentElement, this._currentElement, this._context, this._context);
    }
  },

  /**
   * Perform an update to a mounted component. The componentWillReceiveProps and
   * shouldComponentUpdate methods are called, then (assuming the update isn't
   * skipped) the remaining update lifecycle methods are called and the DOM
   * representation is updated.
   *
   * By default, this implements React's rendering and reconciliation algorithm.
   * Sophisticated clients may wish to override this.
   *
   * @param {ReactReconcileTransaction} transaction
   * @param {ReactElement} prevParentElement
   * @param {ReactElement} nextParentElement
   * @internal
   * @overridable
   */
  updateComponent: function (transaction, prevParentElement, nextParentElement, prevUnmaskedContext, nextUnmaskedContext) {
    var inst = this._instance;

    var nextContext = this._context === nextUnmaskedContext ? inst.context : this._processContext(nextUnmaskedContext);
    var nextProps;

    // Distinguish between a props update versus a simple state update
    if (prevParentElement === nextParentElement) {
      // Skip checking prop types again -- we don't read inst.props to avoid
      // warning for DOM component props in this upgrade
      nextProps = nextParentElement.props;
    } else {
      nextProps = this._processProps(nextParentElement.props);
      // An update here will schedule an update but immediately set
      // _pendingStateQueue which will ensure that any state updates gets
      // immediately reconciled instead of waiting for the next batch.

      if (inst.componentWillReceiveProps) {
        inst.componentWillReceiveProps(nextProps, nextContext);
      }
    }

    var nextState = this._processPendingState(nextProps, nextContext);

    var shouldUpdate = this._pendingForceUpdate || !inst.shouldComponentUpdate || inst.shouldComponentUpdate(nextProps, nextState, nextContext);

    if ("production" !== 'production') {
      "production" !== 'production' ? warning(typeof shouldUpdate !== 'undefined', '%s.shouldComponentUpdate(): Returned undefined instead of a ' + 'boolean value. Make sure to return true or false.', this.getName() || 'ReactCompositeComponent') : undefined;
    }

    if (shouldUpdate) {
      this._pendingForceUpdate = false;
      // Will set `this.props`, `this.state` and `this.context`.
      this._performComponentUpdate(nextParentElement, nextProps, nextState, nextContext, transaction, nextUnmaskedContext);
    } else {
      // If it's determined that a component should not update, we still want
      // to set props and state but we shortcut the rest of the update.
      this._currentElement = nextParentElement;
      this._context = nextUnmaskedContext;
      inst.props = nextProps;
      inst.state = nextState;
      inst.context = nextContext;
    }
  },

  _processPendingState: function (props, context) {
    var inst = this._instance;
    var queue = this._pendingStateQueue;
    var replace = this._pendingReplaceState;
    this._pendingReplaceState = false;
    this._pendingStateQueue = null;

    if (!queue) {
      return inst.state;
    }

    if (replace && queue.length === 1) {
      return queue[0];
    }

    var nextState = assign({}, replace ? queue[0] : inst.state);
    for (var i = replace ? 1 : 0; i < queue.length; i++) {
      var partial = queue[i];
      assign(nextState, typeof partial === 'function' ? partial.call(inst, nextState, props, context) : partial);
    }

    return nextState;
  },

  /**
   * Merges new props and state, notifies delegate methods of update and
   * performs update.
   *
   * @param {ReactElement} nextElement Next element
   * @param {object} nextProps Next public object to set as properties.
   * @param {?object} nextState Next object to set as state.
   * @param {?object} nextContext Next public object to set as context.
   * @param {ReactReconcileTransaction} transaction
   * @param {?object} unmaskedContext
   * @private
   */
  _performComponentUpdate: function (nextElement, nextProps, nextState, nextContext, transaction, unmaskedContext) {
    var inst = this._instance;

    var hasComponentDidUpdate = Boolean(inst.componentDidUpdate);
    var prevProps;
    var prevState;
    var prevContext;
    if (hasComponentDidUpdate) {
      prevProps = inst.props;
      prevState = inst.state;
      prevContext = inst.context;
    }

    if (inst.componentWillUpdate) {
      inst.componentWillUpdate(nextProps, nextState, nextContext);
    }

    this._currentElement = nextElement;
    this._context = unmaskedContext;
    inst.props = nextProps;
    inst.state = nextState;
    inst.context = nextContext;

    this._updateRenderedComponent(transaction, unmaskedContext);

    if (hasComponentDidUpdate) {
      transaction.getReactMountReady().enqueue(inst.componentDidUpdate.bind(inst, prevProps, prevState, prevContext), inst);
    }
  },

  /**
   * Call the component's `render` method and update the DOM accordingly.
   *
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  _updateRenderedComponent: function (transaction, context) {
    var prevComponentInstance = this._renderedComponent;
    var prevRenderedElement = prevComponentInstance._currentElement;
    var nextRenderedElement = this._renderValidatedComponent();
    if (shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {
      ReactReconciler.receiveComponent(prevComponentInstance, nextRenderedElement, transaction, this._processChildContext(context));
    } else {
      // These two IDs are actually the same! But nothing should rely on that.
      var thisID = this._rootNodeID;
      var prevComponentID = prevComponentInstance._rootNodeID;
      ReactReconciler.unmountComponent(prevComponentInstance);

      this._renderedComponent = this._instantiateReactComponent(nextRenderedElement);
      var nextMarkup = ReactReconciler.mountComponent(this._renderedComponent, thisID, transaction, this._processChildContext(context));
      this._replaceNodeWithMarkupByID(prevComponentID, nextMarkup);
    }
  },

  /**
   * @protected
   */
  _replaceNodeWithMarkupByID: function (prevComponentID, nextMarkup) {
    ReactComponentEnvironment.replaceNodeWithMarkupByID(prevComponentID, nextMarkup);
  },

  /**
   * @protected
   */
  _renderValidatedComponentWithoutOwnerOrContext: function () {
    var inst = this._instance;
    var renderedComponent = inst.render();
    if ("production" !== 'production') {
      // We allow auto-mocks to proceed as if they're returning null.
      if (typeof renderedComponent === 'undefined' && inst.render._isMockFunction) {
        // This is probably bad practice. Consider warning here and
        // deprecating this convenience.
        renderedComponent = null;
      }
    }

    return renderedComponent;
  },

  /**
   * @private
   */
  _renderValidatedComponent: function () {
    var renderedComponent;
    ReactCurrentOwner.current = this;
    try {
      renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();
    } finally {
      ReactCurrentOwner.current = null;
    }
    !(
    // TODO: An `isValidNode` function would probably be more appropriate
    renderedComponent === null || renderedComponent === false || ReactElement.isValidElement(renderedComponent)) ? "production" !== 'production' ? invariant(false, '%s.render(): A valid ReactComponent must be returned. You may have ' + 'returned undefined, an array or some other invalid object.', this.getName() || 'ReactCompositeComponent') : invariant(false) : undefined;
    return renderedComponent;
  },

  /**
   * Lazily allocates the refs object and stores `component` as `ref`.
   *
   * @param {string} ref Reference name.
   * @param {component} component Component to store as `ref`.
   * @final
   * @private
   */
  attachRef: function (ref, component) {
    var inst = this.getPublicInstance();
    !(inst != null) ? "production" !== 'production' ? invariant(false, 'Stateless function components cannot have refs.') : invariant(false) : undefined;
    var publicComponentInstance = component.getPublicInstance();
    if ("production" !== 'production') {
      var componentName = component && component.getName ? component.getName() : 'a component';
      "production" !== 'production' ? warning(publicComponentInstance != null, 'Stateless function components cannot be given refs ' + '(See ref "%s" in %s created by %s). ' + 'Attempts to access this ref will fail.', ref, componentName, this.getName()) : undefined;
    }
    var refs = inst.refs === emptyObject ? inst.refs = {} : inst.refs;
    refs[ref] = publicComponentInstance;
  },

  /**
   * Detaches a reference name.
   *
   * @param {string} ref Name to dereference.
   * @final
   * @private
   */
  detachRef: function (ref) {
    var refs = this.getPublicInstance().refs;
    delete refs[ref];
  },

  /**
   * Get a text description of the component that can be used to identify it
   * in error messages.
   * @return {string} The name or null.
   * @internal
   */
  getName: function () {
    var type = this._currentElement.type;
    var constructor = this._instance && this._instance.constructor;
    return type.displayName || constructor && constructor.displayName || type.name || constructor && constructor.name || null;
  },

  /**
   * Get the publicly accessible representation of this component - i.e. what
   * is exposed by refs and returned by render. Can be null for stateless
   * components.
   *
   * @return {ReactComponent} the public component instance.
   * @internal
   */
  getPublicInstance: function () {
    var inst = this._instance;
    if (inst instanceof StatelessComponent) {
      return null;
    }
    return inst;
  },

  // Stub
  _instantiateReactComponent: null

};

ReactPerf.measureMethods(ReactCompositeComponentMixin, 'ReactCompositeComponent', {
  mountComponent: 'mountComponent',
  updateComponent: 'updateComponent',
  _renderValidatedComponent: '_renderValidatedComponent'
});

var ReactCompositeComponent = {

  Mixin: ReactCompositeComponentMixin

};

module.exports = ReactCompositeComponent;
},{"./Object.assign":78,"./ReactComponentEnvironment":88,"./ReactCurrentOwner":90,"./ReactElement":108,"./ReactInstanceMap":118,"./ReactPerf":127,"./ReactPropTypeLocationNames":128,"./ReactPropTypeLocations":129,"./ReactReconciler":132,"./ReactUpdateQueue":138,"./shouldUpdateReactComponent":182,"fbjs/lib/emptyObject":193,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],90:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactCurrentOwner
 */

'use strict';

/**
 * Keeps track of the current owner.
 *
 * The current owner is the component who should own any components that are
 * currently being constructed.
 */
var ReactCurrentOwner = {

  /**
   * @internal
   * @type {ReactComponent}
   */
  current: null

};

module.exports = ReactCurrentOwner;
},{}],91:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOM
 */

/* globals __REACT_DEVTOOLS_GLOBAL_HOOK__*/

'use strict';

var ReactCurrentOwner = require('./ReactCurrentOwner');
var ReactDOMTextComponent = require('./ReactDOMTextComponent');
var ReactDefaultInjection = require('./ReactDefaultInjection');
var ReactInstanceHandles = require('./ReactInstanceHandles');
var ReactMount = require('./ReactMount');
var ReactPerf = require('./ReactPerf');
var ReactReconciler = require('./ReactReconciler');
var ReactUpdates = require('./ReactUpdates');
var ReactVersion = require('./ReactVersion');

var findDOMNode = require('./findDOMNode');
var renderSubtreeIntoContainer = require('./renderSubtreeIntoContainer');
var warning = require('fbjs/lib/warning');

ReactDefaultInjection.inject();

var render = ReactPerf.measure('React', 'render', ReactMount.render);

var React = {
  findDOMNode: findDOMNode,
  render: render,
  unmountComponentAtNode: ReactMount.unmountComponentAtNode,
  version: ReactVersion,

  /* eslint-disable camelcase */
  unstable_batchedUpdates: ReactUpdates.batchedUpdates,
  unstable_renderSubtreeIntoContainer: renderSubtreeIntoContainer
};

// Inject the runtime into a devtools global hook regardless of browser.
// Allows for debugging when the hook is injected on the page.
/* eslint-enable camelcase */
if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.inject === 'function') {
  __REACT_DEVTOOLS_GLOBAL_HOOK__.inject({
    CurrentOwner: ReactCurrentOwner,
    InstanceHandles: ReactInstanceHandles,
    Mount: ReactMount,
    Reconciler: ReactReconciler,
    TextComponent: ReactDOMTextComponent
  });
}

if ("production" !== 'production') {
  var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');
  if (ExecutionEnvironment.canUseDOM && window.top === window.self) {

    // First check if devtools is not installed
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
      // If we're in Chrome or Firefox, provide a download link if not installed.
      if (navigator.userAgent.indexOf('Chrome') > -1 && navigator.userAgent.indexOf('Edge') === -1 || navigator.userAgent.indexOf('Firefox') > -1) {
        console.debug('Download the React DevTools for a better development experience: ' + 'https://fb.me/react-devtools');
      }
    }

    // If we're in IE8, check to see if we are in compatibility mode and provide
    // information on preventing compatibility mode
    var ieCompatibilityMode = document.documentMode && document.documentMode < 8;

    "production" !== 'production' ? warning(!ieCompatibilityMode, 'Internet Explorer is running in compatibility mode; please add the ' + 'following tag to your HTML to prevent this from happening: ' + '<meta http-equiv="X-UA-Compatible" content="IE=edge" />') : undefined;

    var expectedFeatures = [
    // shims
    Array.isArray, Array.prototype.every, Array.prototype.forEach, Array.prototype.indexOf, Array.prototype.map, Date.now, Function.prototype.bind, Object.keys, String.prototype.split, String.prototype.trim,

    // shams
    Object.create, Object.freeze];

    for (var i = 0; i < expectedFeatures.length; i++) {
      if (!expectedFeatures[i]) {
        console.error('One or more ES5 shim/shams expected by React are not available: ' + 'https://fb.me/react-warning-polyfills');
        break;
      }
    }
  }
}

module.exports = React;
},{"./ReactCurrentOwner":90,"./ReactDOMTextComponent":102,"./ReactDefaultInjection":105,"./ReactInstanceHandles":117,"./ReactMount":121,"./ReactPerf":127,"./ReactReconciler":132,"./ReactUpdates":139,"./ReactVersion":140,"./findDOMNode":164,"./renderSubtreeIntoContainer":179,"fbjs/lib/ExecutionEnvironment":186,"fbjs/lib/warning":211}],92:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMButton
 */

'use strict';

var mouseListenerNames = {
  onClick: true,
  onDoubleClick: true,
  onMouseDown: true,
  onMouseMove: true,
  onMouseUp: true,

  onClickCapture: true,
  onDoubleClickCapture: true,
  onMouseDownCapture: true,
  onMouseMoveCapture: true,
  onMouseUpCapture: true
};

/**
 * Implements a <button> native component that does not receive mouse events
 * when `disabled` is set.
 */
var ReactDOMButton = {
  getNativeProps: function (inst, props, context) {
    if (!props.disabled) {
      return props;
    }

    // Copy the props, except the mouse listeners
    var nativeProps = {};
    for (var key in props) {
      if (props.hasOwnProperty(key) && !mouseListenerNames[key]) {
        nativeProps[key] = props[key];
      }
    }

    return nativeProps;
  }
};

module.exports = ReactDOMButton;
},{}],93:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMComponent
 * @typechecks static-only
 */

/* global hasOwnProperty:true */

'use strict';

var AutoFocusUtils = require('./AutoFocusUtils');
var CSSPropertyOperations = require('./CSSPropertyOperations');
var DOMProperty = require('./DOMProperty');
var DOMPropertyOperations = require('./DOMPropertyOperations');
var EventConstants = require('./EventConstants');
var ReactBrowserEventEmitter = require('./ReactBrowserEventEmitter');
var ReactComponentBrowserEnvironment = require('./ReactComponentBrowserEnvironment');
var ReactDOMButton = require('./ReactDOMButton');
var ReactDOMInput = require('./ReactDOMInput');
var ReactDOMOption = require('./ReactDOMOption');
var ReactDOMSelect = require('./ReactDOMSelect');
var ReactDOMTextarea = require('./ReactDOMTextarea');
var ReactMount = require('./ReactMount');
var ReactMultiChild = require('./ReactMultiChild');
var ReactPerf = require('./ReactPerf');
var ReactUpdateQueue = require('./ReactUpdateQueue');

var assign = require('./Object.assign');
var canDefineProperty = require('./canDefineProperty');
var escapeTextContentForBrowser = require('./escapeTextContentForBrowser');
var invariant = require('fbjs/lib/invariant');
var isEventSupported = require('./isEventSupported');
var keyOf = require('fbjs/lib/keyOf');
var setInnerHTML = require('./setInnerHTML');
var setTextContent = require('./setTextContent');
var shallowEqual = require('fbjs/lib/shallowEqual');
var validateDOMNesting = require('./validateDOMNesting');
var warning = require('fbjs/lib/warning');

var deleteListener = ReactBrowserEventEmitter.deleteListener;
var listenTo = ReactBrowserEventEmitter.listenTo;
var registrationNameModules = ReactBrowserEventEmitter.registrationNameModules;

// For quickly matching children type, to test if can be treated as content.
var CONTENT_TYPES = { 'string': true, 'number': true };

var CHILDREN = keyOf({ children: null });
var STYLE = keyOf({ style: null });
var HTML = keyOf({ __html: null });

var ELEMENT_NODE_TYPE = 1;

function getDeclarationErrorAddendum(internalInstance) {
  if (internalInstance) {
    var owner = internalInstance._currentElement._owner || null;
    if (owner) {
      var name = owner.getName();
      if (name) {
        return ' This DOM node was rendered by `' + name + '`.';
      }
    }
  }
  return '';
}

var legacyPropsDescriptor;
if ("production" !== 'production') {
  legacyPropsDescriptor = {
    props: {
      enumerable: false,
      get: function () {
        var component = this._reactInternalComponent;
        "production" !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .props of a DOM node; instead, ' + 'recreate the props as `render` did originally or read the DOM ' + 'properties/attributes directly from this node (e.g., ' + 'this.refs.box.className).%s', getDeclarationErrorAddendum(component)) : undefined;
        return component._currentElement.props;
      }
    }
  };
}

function legacyGetDOMNode() {
  if ("production" !== 'production') {
    var component = this._reactInternalComponent;
    "production" !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .getDOMNode() of a DOM node; ' + 'instead, use the node directly.%s', getDeclarationErrorAddendum(component)) : undefined;
  }
  return this;
}

function legacyIsMounted() {
  var component = this._reactInternalComponent;
  if ("production" !== 'production') {
    "production" !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .isMounted() of a DOM node.%s', getDeclarationErrorAddendum(component)) : undefined;
  }
  return !!component;
}

function legacySetStateEtc() {
  if ("production" !== 'production') {
    var component = this._reactInternalComponent;
    "production" !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .setState(), .replaceState(), or ' + '.forceUpdate() of a DOM node. This is a no-op.%s', getDeclarationErrorAddendum(component)) : undefined;
  }
}

function legacySetProps(partialProps, callback) {
  var component = this._reactInternalComponent;
  if ("production" !== 'production') {
    "production" !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .setProps() of a DOM node. ' + 'Instead, call ReactDOM.render again at the top level.%s', getDeclarationErrorAddendum(component)) : undefined;
  }
  if (!component) {
    return;
  }
  ReactUpdateQueue.enqueueSetPropsInternal(component, partialProps);
  if (callback) {
    ReactUpdateQueue.enqueueCallbackInternal(component, callback);
  }
}

function legacyReplaceProps(partialProps, callback) {
  var component = this._reactInternalComponent;
  if ("production" !== 'production') {
    "production" !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .replaceProps() of a DOM node. ' + 'Instead, call ReactDOM.render again at the top level.%s', getDeclarationErrorAddendum(component)) : undefined;
  }
  if (!component) {
    return;
  }
  ReactUpdateQueue.enqueueReplacePropsInternal(component, partialProps);
  if (callback) {
    ReactUpdateQueue.enqueueCallbackInternal(component, callback);
  }
}

function friendlyStringify(obj) {
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return '[' + obj.map(friendlyStringify).join(', ') + ']';
    } else {
      var pairs = [];
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          var keyEscaped = /^[a-z$_][\w$_]*$/i.test(key) ? key : JSON.stringify(key);
          pairs.push(keyEscaped + ': ' + friendlyStringify(obj[key]));
        }
      }
      return '{' + pairs.join(', ') + '}';
    }
  } else if (typeof obj === 'string') {
    return JSON.stringify(obj);
  } else if (typeof obj === 'function') {
    return '[function object]';
  }
  // Differs from JSON.stringify in that undefined becauses undefined and that
  // inf and nan don't become null
  return String(obj);
}

var styleMutationWarning = {};

function checkAndWarnForMutatedStyle(style1, style2, component) {
  if (style1 == null || style2 == null) {
    return;
  }
  if (shallowEqual(style1, style2)) {
    return;
  }

  var componentName = component._tag;
  var owner = component._currentElement._owner;
  var ownerName;
  if (owner) {
    ownerName = owner.getName();
  }

  var hash = ownerName + '|' + componentName;

  if (styleMutationWarning.hasOwnProperty(hash)) {
    return;
  }

  styleMutationWarning[hash] = true;

  "production" !== 'production' ? warning(false, '`%s` was passed a style object that has previously been mutated. ' + 'Mutating `style` is deprecated. Consider cloning it beforehand. Check ' + 'the `render` %s. Previous style: %s. Mutated style: %s.', componentName, owner ? 'of `' + ownerName + '`' : 'using <' + componentName + '>', friendlyStringify(style1), friendlyStringify(style2)) : undefined;
}

/**
 * @param {object} component
 * @param {?object} props
 */
function assertValidProps(component, props) {
  if (!props) {
    return;
  }
  // Note the use of `==` which checks for null or undefined.
  if ("production" !== 'production') {
    if (voidElementTags[component._tag]) {
      "production" !== 'production' ? warning(props.children == null && props.dangerouslySetInnerHTML == null, '%s is a void element tag and must not have `children` or ' + 'use `props.dangerouslySetInnerHTML`.%s', component._tag, component._currentElement._owner ? ' Check the render method of ' + component._currentElement._owner.getName() + '.' : '') : undefined;
    }
  }
  if (props.dangerouslySetInnerHTML != null) {
    !(props.children == null) ? "production" !== 'production' ? invariant(false, 'Can only set one of `children` or `props.dangerouslySetInnerHTML`.') : invariant(false) : undefined;
    !(typeof props.dangerouslySetInnerHTML === 'object' && HTML in props.dangerouslySetInnerHTML) ? "production" !== 'production' ? invariant(false, '`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. ' + 'Please visit https://fb.me/react-invariant-dangerously-set-inner-html ' + 'for more information.') : invariant(false) : undefined;
  }
  if ("production" !== 'production') {
    "production" !== 'production' ? warning(props.innerHTML == null, 'Directly setting property `innerHTML` is not permitted. ' + 'For more information, lookup documentation on `dangerouslySetInnerHTML`.') : undefined;
    "production" !== 'production' ? warning(!props.contentEditable || props.children == null, 'A component is `contentEditable` and contains `children` managed by ' + 'React. It is now your responsibility to guarantee that none of ' + 'those nodes are unexpectedly modified or duplicated. This is ' + 'probably not intentional.') : undefined;
  }
  !(props.style == null || typeof props.style === 'object') ? "production" !== 'production' ? invariant(false, 'The `style` prop expects a mapping from style properties to values, ' + 'not a string. For example, style={{marginRight: spacing + \'em\'}} when ' + 'using JSX.%s', getDeclarationErrorAddendum(component)) : invariant(false) : undefined;
}

function enqueuePutListener(id, registrationName, listener, transaction) {
  if ("production" !== 'production') {
    // IE8 has no API for event capturing and the `onScroll` event doesn't
    // bubble.
    "production" !== 'production' ? warning(registrationName !== 'onScroll' || isEventSupported('scroll', true), 'This browser doesn\'t support the `onScroll` event') : undefined;
  }
  var container = ReactMount.findReactContainerForID(id);
  if (container) {
    var doc = container.nodeType === ELEMENT_NODE_TYPE ? container.ownerDocument : container;
    listenTo(registrationName, doc);
  }
  transaction.getReactMountReady().enqueue(putListener, {
    id: id,
    registrationName: registrationName,
    listener: listener
  });
}

function putListener() {
  var listenerToPut = this;
  ReactBrowserEventEmitter.putListener(listenerToPut.id, listenerToPut.registrationName, listenerToPut.listener);
}

// There are so many media events, it makes sense to just
// maintain a list rather than create a `trapBubbledEvent` for each
var mediaEvents = {
  topAbort: 'abort',
  topCanPlay: 'canplay',
  topCanPlayThrough: 'canplaythrough',
  topDurationChange: 'durationchange',
  topEmptied: 'emptied',
  topEncrypted: 'encrypted',
  topEnded: 'ended',
  topError: 'error',
  topLoadedData: 'loadeddata',
  topLoadedMetadata: 'loadedmetadata',
  topLoadStart: 'loadstart',
  topPause: 'pause',
  topPlay: 'play',
  topPlaying: 'playing',
  topProgress: 'progress',
  topRateChange: 'ratechange',
  topSeeked: 'seeked',
  topSeeking: 'seeking',
  topStalled: 'stalled',
  topSuspend: 'suspend',
  topTimeUpdate: 'timeupdate',
  topVolumeChange: 'volumechange',
  topWaiting: 'waiting'
};

function trapBubbledEventsLocal() {
  var inst = this;
  // If a component renders to null or if another component fatals and causes
  // the state of the tree to be corrupted, `node` here can be null.
  !inst._rootNodeID ? "production" !== 'production' ? invariant(false, 'Must be mounted to trap events') : invariant(false) : undefined;
  var node = ReactMount.getNode(inst._rootNodeID);
  !node ? "production" !== 'production' ? invariant(false, 'trapBubbledEvent(...): Requires node to be rendered.') : invariant(false) : undefined;

  switch (inst._tag) {
    case 'iframe':
      inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topLoad, 'load', node)];
      break;
    case 'video':
    case 'audio':

      inst._wrapperState.listeners = [];
      // create listener for each media event
      for (var event in mediaEvents) {
        if (mediaEvents.hasOwnProperty(event)) {
          inst._wrapperState.listeners.push(ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes[event], mediaEvents[event], node));
        }
      }

      break;
    case 'img':
      inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topError, 'error', node), ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topLoad, 'load', node)];
      break;
    case 'form':
      inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topReset, 'reset', node), ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topSubmit, 'submit', node)];
      break;
  }
}

function mountReadyInputWrapper() {
  ReactDOMInput.mountReadyWrapper(this);
}

function postUpdateSelectWrapper() {
  ReactDOMSelect.postUpdateWrapper(this);
}

// For HTML, certain tags should omit their close tag. We keep a whitelist for
// those special cased tags.

var omittedCloseTags = {
  'area': true,
  'base': true,
  'br': true,
  'col': true,
  'embed': true,
  'hr': true,
  'img': true,
  'input': true,
  'keygen': true,
  'link': true,
  'meta': true,
  'param': true,
  'source': true,
  'track': true,
  'wbr': true
};

// NOTE: menuitem's close tag should be omitted, but that causes problems.
var newlineEatingTags = {
  'listing': true,
  'pre': true,
  'textarea': true
};

// For HTML, certain tags cannot have children. This has the same purpose as
// `omittedCloseTags` except that `menuitem` should still have its closing tag.

var voidElementTags = assign({
  'menuitem': true
}, omittedCloseTags);

// We accept any tag to be rendered but since this gets injected into arbitrary
// HTML, we want to make sure that it's a safe tag.
// http://www.w3.org/TR/REC-xml/#NT-Name

var VALID_TAG_REGEX = /^[a-zA-Z][a-zA-Z:_\.\-\d]*$/; // Simplified subset
var validatedTagCache = {};
var hasOwnProperty = ({}).hasOwnProperty;

function validateDangerousTag(tag) {
  if (!hasOwnProperty.call(validatedTagCache, tag)) {
    !VALID_TAG_REGEX.test(tag) ? "production" !== 'production' ? invariant(false, 'Invalid tag: %s', tag) : invariant(false) : undefined;
    validatedTagCache[tag] = true;
  }
}

function processChildContextDev(context, inst) {
  // Pass down our tag name to child components for validation purposes
  context = assign({}, context);
  var info = context[validateDOMNesting.ancestorInfoContextKey];
  context[validateDOMNesting.ancestorInfoContextKey] = validateDOMNesting.updatedAncestorInfo(info, inst._tag, inst);
  return context;
}

function isCustomComponent(tagName, props) {
  return tagName.indexOf('-') >= 0 || props.is != null;
}

/**
 * Creates a new React class that is idempotent and capable of containing other
 * React components. It accepts event listeners and DOM properties that are
 * valid according to `DOMProperty`.
 *
 *  - Event listeners: `onClick`, `onMouseDown`, etc.
 *  - DOM properties: `className`, `name`, `title`, etc.
 *
 * The `style` property functions differently from the DOM API. It accepts an
 * object mapping of style properties to values.
 *
 * @constructor ReactDOMComponent
 * @extends ReactMultiChild
 */
function ReactDOMComponent(tag) {
  validateDangerousTag(tag);
  this._tag = tag.toLowerCase();
  this._renderedChildren = null;
  this._previousStyle = null;
  this._previousStyleCopy = null;
  this._rootNodeID = null;
  this._wrapperState = null;
  this._topLevelWrapper = null;
  this._nodeWithLegacyProperties = null;
  if ("production" !== 'production') {
    this._unprocessedContextDev = null;
    this._processedContextDev = null;
  }
}

ReactDOMComponent.displayName = 'ReactDOMComponent';

ReactDOMComponent.Mixin = {

  construct: function (element) {
    this._currentElement = element;
  },

  /**
   * Generates root tag markup then recurses. This method has side effects and
   * is not idempotent.
   *
   * @internal
   * @param {string} rootID The root DOM ID for this node.
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @param {object} context
   * @return {string} The computed markup.
   */
  mountComponent: function (rootID, transaction, context) {
    this._rootNodeID = rootID;

    var props = this._currentElement.props;

    switch (this._tag) {
      case 'iframe':
      case 'img':
      case 'form':
      case 'video':
      case 'audio':
        this._wrapperState = {
          listeners: null
        };
        transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
        break;
      case 'button':
        props = ReactDOMButton.getNativeProps(this, props, context);
        break;
      case 'input':
        ReactDOMInput.mountWrapper(this, props, context);
        props = ReactDOMInput.getNativeProps(this, props, context);
        break;
      case 'option':
        ReactDOMOption.mountWrapper(this, props, context);
        props = ReactDOMOption.getNativeProps(this, props, context);
        break;
      case 'select':
        ReactDOMSelect.mountWrapper(this, props, context);
        props = ReactDOMSelect.getNativeProps(this, props, context);
        context = ReactDOMSelect.processChildContext(this, props, context);
        break;
      case 'textarea':
        ReactDOMTextarea.mountWrapper(this, props, context);
        props = ReactDOMTextarea.getNativeProps(this, props, context);
        break;
    }

    assertValidProps(this, props);
    if ("production" !== 'production') {
      if (context[validateDOMNesting.ancestorInfoContextKey]) {
        validateDOMNesting(this._tag, this, context[validateDOMNesting.ancestorInfoContextKey]);
      }
    }

    if ("production" !== 'production') {
      this._unprocessedContextDev = context;
      this._processedContextDev = processChildContextDev(context, this);
      context = this._processedContextDev;
    }

    var mountImage;
    if (transaction.useCreateElement) {
      var ownerDocument = context[ReactMount.ownerDocumentContextKey];
      var el = ownerDocument.createElement(this._currentElement.type);
      DOMPropertyOperations.setAttributeForID(el, this._rootNodeID);
      // Populate node cache
      ReactMount.getID(el);
      this._updateDOMProperties({}, props, transaction, el);
      this._createInitialChildren(transaction, props, context, el);
      mountImage = el;
    } else {
      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);
      var tagContent = this._createContentMarkup(transaction, props, context);
      if (!tagContent && omittedCloseTags[this._tag]) {
        mountImage = tagOpen + '/>';
      } else {
        mountImage = tagOpen + '>' + tagContent + '</' + this._currentElement.type + '>';
      }
    }

    switch (this._tag) {
      case 'input':
        transaction.getReactMountReady().enqueue(mountReadyInputWrapper, this);
      // falls through
      case 'button':
      case 'select':
      case 'textarea':
        if (props.autoFocus) {
          transaction.getReactMountReady().enqueue(AutoFocusUtils.focusDOMComponent, this);
        }
        break;
    }

    return mountImage;
  },

  /**
   * Creates markup for the open tag and all attributes.
   *
   * This method has side effects because events get registered.
   *
   * Iterating over object properties is faster than iterating over arrays.
   * @see http://jsperf.com/obj-vs-arr-iteration
   *
   * @private
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @param {object} props
   * @return {string} Markup of opening tag.
   */
  _createOpenTagMarkupAndPutListeners: function (transaction, props) {
    var ret = '<' + this._currentElement.type;

    for (var propKey in props) {
      if (!props.hasOwnProperty(propKey)) {
        continue;
      }
      var propValue = props[propKey];
      if (propValue == null) {
        continue;
      }
      if (registrationNameModules.hasOwnProperty(propKey)) {
        if (propValue) {
          enqueuePutListener(this._rootNodeID, propKey, propValue, transaction);
        }
      } else {
        if (propKey === STYLE) {
          if (propValue) {
            if ("production" !== 'production') {
              // See `_updateDOMProperties`. style block
              this._previousStyle = propValue;
            }
            propValue = this._previousStyleCopy = assign({}, props.style);
          }
          propValue = CSSPropertyOperations.createMarkupForStyles(propValue);
        }
        var markup = null;
        if (this._tag != null && isCustomComponent(this._tag, props)) {
          if (propKey !== CHILDREN) {
            markup = DOMPropertyOperations.createMarkupForCustomAttribute(propKey, propValue);
          }
        } else {
          markup = DOMPropertyOperations.createMarkupForProperty(propKey, propValue);
        }
        if (markup) {
          ret += ' ' + markup;
        }
      }
    }

    // For static pages, no need to put React ID and checksum. Saves lots of
    // bytes.
    if (transaction.renderToStaticMarkup) {
      return ret;
    }

    var markupForID = DOMPropertyOperations.createMarkupForID(this._rootNodeID);
    return ret + ' ' + markupForID;
  },

  /**
   * Creates markup for the content between the tags.
   *
   * @private
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @param {object} props
   * @param {object} context
   * @return {string} Content markup.
   */
  _createContentMarkup: function (transaction, props, context) {
    var ret = '';

    // Intentional use of != to avoid catching zero/false.
    var innerHTML = props.dangerouslySetInnerHTML;
    if (innerHTML != null) {
      if (innerHTML.__html != null) {
        ret = innerHTML.__html;
      }
    } else {
      var contentToUse = CONTENT_TYPES[typeof props.children] ? props.children : null;
      var childrenToUse = contentToUse != null ? null : props.children;
      if (contentToUse != null) {
        // TODO: Validate that text is allowed as a child of this node
        ret = escapeTextContentForBrowser(contentToUse);
      } else if (childrenToUse != null) {
        var mountImages = this.mountChildren(childrenToUse, transaction, context);
        ret = mountImages.join('');
      }
    }
    if (newlineEatingTags[this._tag] && ret.charAt(0) === '\n') {
      // text/html ignores the first character in these tags if it's a newline
      // Prefer to break application/xml over text/html (for now) by adding
      // a newline specifically to get eaten by the parser. (Alternately for
      // textareas, replacing "^\n" with "\r\n" doesn't get eaten, and the first
      // \r is normalized out by HTMLTextAreaElement#value.)
      // See: <http://www.w3.org/TR/html-polyglot/#newlines-in-textarea-and-pre>
      // See: <http://www.w3.org/TR/html5/syntax.html#element-restrictions>
      // See: <http://www.w3.org/TR/html5/syntax.html#newlines>
      // See: Parsing of "textarea" "listing" and "pre" elements
      //  from <http://www.w3.org/TR/html5/syntax.html#parsing-main-inbody>
      return '\n' + ret;
    } else {
      return ret;
    }
  },

  _createInitialChildren: function (transaction, props, context, el) {
    // Intentional use of != to avoid catching zero/false.
    var innerHTML = props.dangerouslySetInnerHTML;
    if (innerHTML != null) {
      if (innerHTML.__html != null) {
        setInnerHTML(el, innerHTML.__html);
      }
    } else {
      var contentToUse = CONTENT_TYPES[typeof props.children] ? props.children : null;
      var childrenToUse = contentToUse != null ? null : props.children;
      if (contentToUse != null) {
        // TODO: Validate that text is allowed as a child of this node
        setTextContent(el, contentToUse);
      } else if (childrenToUse != null) {
        var mountImages = this.mountChildren(childrenToUse, transaction, context);
        for (var i = 0; i < mountImages.length; i++) {
          el.appendChild(mountImages[i]);
        }
      }
    }
  },

  /**
   * Receives a next element and updates the component.
   *
   * @internal
   * @param {ReactElement} nextElement
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @param {object} context
   */
  receiveComponent: function (nextElement, transaction, context) {
    var prevElement = this._currentElement;
    this._currentElement = nextElement;
    this.updateComponent(transaction, prevElement, nextElement, context);
  },

  /**
   * Updates a native DOM component after it has already been allocated and
   * attached to the DOM. Reconciles the root DOM node, then recurses.
   *
   * @param {ReactReconcileTransaction} transaction
   * @param {ReactElement} prevElement
   * @param {ReactElement} nextElement
   * @internal
   * @overridable
   */
  updateComponent: function (transaction, prevElement, nextElement, context) {
    var lastProps = prevElement.props;
    var nextProps = this._currentElement.props;

    switch (this._tag) {
      case 'button':
        lastProps = ReactDOMButton.getNativeProps(this, lastProps);
        nextProps = ReactDOMButton.getNativeProps(this, nextProps);
        break;
      case 'input':
        ReactDOMInput.updateWrapper(this);
        lastProps = ReactDOMInput.getNativeProps(this, lastProps);
        nextProps = ReactDOMInput.getNativeProps(this, nextProps);
        break;
      case 'option':
        lastProps = ReactDOMOption.getNativeProps(this, lastProps);
        nextProps = ReactDOMOption.getNativeProps(this, nextProps);
        break;
      case 'select':
        lastProps = ReactDOMSelect.getNativeProps(this, lastProps);
        nextProps = ReactDOMSelect.getNativeProps(this, nextProps);
        break;
      case 'textarea':
        ReactDOMTextarea.updateWrapper(this);
        lastProps = ReactDOMTextarea.getNativeProps(this, lastProps);
        nextProps = ReactDOMTextarea.getNativeProps(this, nextProps);
        break;
    }

    if ("production" !== 'production') {
      // If the context is reference-equal to the old one, pass down the same
      // processed object so the update bailout in ReactReconciler behaves
      // correctly (and identically in dev and prod). See #5005.
      if (this._unprocessedContextDev !== context) {
        this._unprocessedContextDev = context;
        this._processedContextDev = processChildContextDev(context, this);
      }
      context = this._processedContextDev;
    }

    assertValidProps(this, nextProps);
    this._updateDOMProperties(lastProps, nextProps, transaction, null);
    this._updateDOMChildren(lastProps, nextProps, transaction, context);

    if (!canDefineProperty && this._nodeWithLegacyProperties) {
      this._nodeWithLegacyProperties.props = nextProps;
    }

    if (this._tag === 'select') {
      // <select> value update needs to occur after <option> children
      // reconciliation
      transaction.getReactMountReady().enqueue(postUpdateSelectWrapper, this);
    }
  },

  /**
   * Reconciles the properties by detecting differences in property values and
   * updating the DOM as necessary. This function is probably the single most
   * critical path for performance optimization.
   *
   * TODO: Benchmark whether checking for changed values in memory actually
   *       improves performance (especially statically positioned elements).
   * TODO: Benchmark the effects of putting this at the top since 99% of props
   *       do not change for a given reconciliation.
   * TODO: Benchmark areas that can be improved with caching.
   *
   * @private
   * @param {object} lastProps
   * @param {object} nextProps
   * @param {ReactReconcileTransaction} transaction
   * @param {?DOMElement} node
   */
  _updateDOMProperties: function (lastProps, nextProps, transaction, node) {
    var propKey;
    var styleName;
    var styleUpdates;
    for (propKey in lastProps) {
      if (nextProps.hasOwnProperty(propKey) || !lastProps.hasOwnProperty(propKey)) {
        continue;
      }
      if (propKey === STYLE) {
        var lastStyle = this._previousStyleCopy;
        for (styleName in lastStyle) {
          if (lastStyle.hasOwnProperty(styleName)) {
            styleUpdates = styleUpdates || {};
            styleUpdates[styleName] = '';
          }
        }
        this._previousStyleCopy = null;
      } else if (registrationNameModules.hasOwnProperty(propKey)) {
        if (lastProps[propKey]) {
          // Only call deleteListener if there was a listener previously or
          // else willDeleteListener gets called when there wasn't actually a
          // listener (e.g., onClick={null})
          deleteListener(this._rootNodeID, propKey);
        }
      } else if (DOMProperty.properties[propKey] || DOMProperty.isCustomAttribute(propKey)) {
        if (!node) {
          node = ReactMount.getNode(this._rootNodeID);
        }
        DOMPropertyOperations.deleteValueForProperty(node, propKey);
      }
    }
    for (propKey in nextProps) {
      var nextProp = nextProps[propKey];
      var lastProp = propKey === STYLE ? this._previousStyleCopy : lastProps[propKey];
      if (!nextProps.hasOwnProperty(propKey) || nextProp === lastProp) {
        continue;
      }
      if (propKey === STYLE) {
        if (nextProp) {
          if ("production" !== 'production') {
            checkAndWarnForMutatedStyle(this._previousStyleCopy, this._previousStyle, this);
            this._previousStyle = nextProp;
          }
          nextProp = this._previousStyleCopy = assign({}, nextProp);
        } else {
          this._previousStyleCopy = null;
        }
        if (lastProp) {
          // Unset styles on `lastProp` but not on `nextProp`.
          for (styleName in lastProp) {
            if (lastProp.hasOwnProperty(styleName) && (!nextProp || !nextProp.hasOwnProperty(styleName))) {
              styleUpdates = styleUpdates || {};
              styleUpdates[styleName] = '';
            }
          }
          // Update styles that changed since `lastProp`.
          for (styleName in nextProp) {
            if (nextProp.hasOwnProperty(styleName) && lastProp[styleName] !== nextProp[styleName]) {
              styleUpdates = styleUpdates || {};
              styleUpdates[styleName] = nextProp[styleName];
            }
          }
        } else {
          // Relies on `updateStylesByID` not mutating `styleUpdates`.
          styleUpdates = nextProp;
        }
      } else if (registrationNameModules.hasOwnProperty(propKey)) {
        if (nextProp) {
          enqueuePutListener(this._rootNodeID, propKey, nextProp, transaction);
        } else if (lastProp) {
          deleteListener(this._rootNodeID, propKey);
        }
      } else if (isCustomComponent(this._tag, nextProps)) {
        if (!node) {
          node = ReactMount.getNode(this._rootNodeID);
        }
        if (propKey === CHILDREN) {
          nextProp = null;
        }
        DOMPropertyOperations.setValueForAttribute(node, propKey, nextProp);
      } else if (DOMProperty.properties[propKey] || DOMProperty.isCustomAttribute(propKey)) {
        if (!node) {
          node = ReactMount.getNode(this._rootNodeID);
        }
        // If we're updating to null or undefined, we should remove the property
        // from the DOM node instead of inadvertantly setting to a string. This
        // brings us in line with the same behavior we have on initial render.
        if (nextProp != null) {
          DOMPropertyOperations.setValueForProperty(node, propKey, nextProp);
        } else {
          DOMPropertyOperations.deleteValueForProperty(node, propKey);
        }
      }
    }
    if (styleUpdates) {
      if (!node) {
        node = ReactMount.getNode(this._rootNodeID);
      }
      CSSPropertyOperations.setValueForStyles(node, styleUpdates);
    }
  },

  /**
   * Reconciles the children with the various properties that affect the
   * children content.
   *
   * @param {object} lastProps
   * @param {object} nextProps
   * @param {ReactReconcileTransaction} transaction
   * @param {object} context
   */
  _updateDOMChildren: function (lastProps, nextProps, transaction, context) {
    var lastContent = CONTENT_TYPES[typeof lastProps.children] ? lastProps.children : null;
    var nextContent = CONTENT_TYPES[typeof nextProps.children] ? nextProps.children : null;

    var lastHtml = lastProps.dangerouslySetInnerHTML && lastProps.dangerouslySetInnerHTML.__html;
    var nextHtml = nextProps.dangerouslySetInnerHTML && nextProps.dangerouslySetInnerHTML.__html;

    // Note the use of `!=` which checks for null or undefined.
    var lastChildren = lastContent != null ? null : lastProps.children;
    var nextChildren = nextContent != null ? null : nextProps.children;

    // If we're switching from children to content/html or vice versa, remove
    // the old content
    var lastHasContentOrHtml = lastContent != null || lastHtml != null;
    var nextHasContentOrHtml = nextContent != null || nextHtml != null;
    if (lastChildren != null && nextChildren == null) {
      this.updateChildren(null, transaction, context);
    } else if (lastHasContentOrHtml && !nextHasContentOrHtml) {
      this.updateTextContent('');
    }

    if (nextContent != null) {
      if (lastContent !== nextContent) {
        this.updateTextContent('' + nextContent);
      }
    } else if (nextHtml != null) {
      if (lastHtml !== nextHtml) {
        this.updateMarkup('' + nextHtml);
      }
    } else if (nextChildren != null) {
      this.updateChildren(nextChildren, transaction, context);
    }
  },

  /**
   * Destroys all event registrations for this instance. Does not remove from
   * the DOM. That must be done by the parent.
   *
   * @internal
   */
  unmountComponent: function () {
    switch (this._tag) {
      case 'iframe':
      case 'img':
      case 'form':
      case 'video':
      case 'audio':
        var listeners = this._wrapperState.listeners;
        if (listeners) {
          for (var i = 0; i < listeners.length; i++) {
            listeners[i].remove();
          }
        }
        break;
      case 'input':
        ReactDOMInput.unmountWrapper(this);
        break;
      case 'html':
      case 'head':
      case 'body':
        /**
         * Components like <html> <head> and <body> can't be removed or added
         * easily in a cross-browser way, however it's valuable to be able to
         * take advantage of React's reconciliation for styling and <title>
         * management. So we just document it and throw in dangerous cases.
         */
        !false ? "production" !== 'production' ? invariant(false, '<%s> tried to unmount. Because of cross-browser quirks it is ' + 'impossible to unmount some top-level components (eg <html>, ' + '<head>, and <body>) reliably and efficiently. To fix this, have a ' + 'single top-level component that never unmounts render these ' + 'elements.', this._tag) : invariant(false) : undefined;
        break;
    }

    this.unmountChildren();
    ReactBrowserEventEmitter.deleteAllListeners(this._rootNodeID);
    ReactComponentBrowserEnvironment.unmountIDFromEnvironment(this._rootNodeID);
    this._rootNodeID = null;
    this._wrapperState = null;
    if (this._nodeWithLegacyProperties) {
      var node = this._nodeWithLegacyProperties;
      node._reactInternalComponent = null;
      this._nodeWithLegacyProperties = null;
    }
  },

  getPublicInstance: function () {
    if (!this._nodeWithLegacyProperties) {
      var node = ReactMount.getNode(this._rootNodeID);

      node._reactInternalComponent = this;
      node.getDOMNode = legacyGetDOMNode;
      node.isMounted = legacyIsMounted;
      node.setState = legacySetStateEtc;
      node.replaceState = legacySetStateEtc;
      node.forceUpdate = legacySetStateEtc;
      node.setProps = legacySetProps;
      node.replaceProps = legacyReplaceProps;

      if ("production" !== 'production') {
        if (canDefineProperty) {
          Object.defineProperties(node, legacyPropsDescriptor);
        } else {
          // updateComponent will update this property on subsequent renders
          node.props = this._currentElement.props;
        }
      } else {
        // updateComponent will update this property on subsequent renders
        node.props = this._currentElement.props;
      }

      this._nodeWithLegacyProperties = node;
    }
    return this._nodeWithLegacyProperties;
  }

};

ReactPerf.measureMethods(ReactDOMComponent, 'ReactDOMComponent', {
  mountComponent: 'mountComponent',
  updateComponent: 'updateComponent'
});

assign(ReactDOMComponent.prototype, ReactDOMComponent.Mixin, ReactMultiChild.Mixin);

module.exports = ReactDOMComponent;
},{"./AutoFocusUtils":57,"./CSSPropertyOperations":60,"./DOMProperty":65,"./DOMPropertyOperations":66,"./EventConstants":70,"./Object.assign":78,"./ReactBrowserEventEmitter":82,"./ReactComponentBrowserEnvironment":87,"./ReactDOMButton":92,"./ReactDOMInput":97,"./ReactDOMOption":98,"./ReactDOMSelect":99,"./ReactDOMTextarea":103,"./ReactMount":121,"./ReactMultiChild":122,"./ReactPerf":127,"./ReactUpdateQueue":138,"./canDefineProperty":160,"./escapeTextContentForBrowser":163,"./isEventSupported":175,"./setInnerHTML":180,"./setTextContent":181,"./validateDOMNesting":184,"fbjs/lib/invariant":200,"fbjs/lib/keyOf":204,"fbjs/lib/shallowEqual":209,"fbjs/lib/warning":211}],94:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMFactories
 * @typechecks static-only
 */

'use strict';

var ReactElement = require('./ReactElement');
var ReactElementValidator = require('./ReactElementValidator');

var mapObject = require('fbjs/lib/mapObject');

/**
 * Create a factory that creates HTML tag elements.
 *
 * @param {string} tag Tag name (e.g. `div`).
 * @private
 */
function createDOMFactory(tag) {
  if ("production" !== 'production') {
    return ReactElementValidator.createFactory(tag);
  }
  return ReactElement.createFactory(tag);
}

/**
 * Creates a mapping from supported HTML tags to `ReactDOMComponent` classes.
 * This is also accessible via `React.DOM`.
 *
 * @public
 */
var ReactDOMFactories = mapObject({
  a: 'a',
  abbr: 'abbr',
  address: 'address',
  area: 'area',
  article: 'article',
  aside: 'aside',
  audio: 'audio',
  b: 'b',
  base: 'base',
  bdi: 'bdi',
  bdo: 'bdo',
  big: 'big',
  blockquote: 'blockquote',
  body: 'body',
  br: 'br',
  button: 'button',
  canvas: 'canvas',
  caption: 'caption',
  cite: 'cite',
  code: 'code',
  col: 'col',
  colgroup: 'colgroup',
  data: 'data',
  datalist: 'datalist',
  dd: 'dd',
  del: 'del',
  details: 'details',
  dfn: 'dfn',
  dialog: 'dialog',
  div: 'div',
  dl: 'dl',
  dt: 'dt',
  em: 'em',
  embed: 'embed',
  fieldset: 'fieldset',
  figcaption: 'figcaption',
  figure: 'figure',
  footer: 'footer',
  form: 'form',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  head: 'head',
  header: 'header',
  hgroup: 'hgroup',
  hr: 'hr',
  html: 'html',
  i: 'i',
  iframe: 'iframe',
  img: 'img',
  input: 'input',
  ins: 'ins',
  kbd: 'kbd',
  keygen: 'keygen',
  label: 'label',
  legend: 'legend',
  li: 'li',
  link: 'link',
  main: 'main',
  map: 'map',
  mark: 'mark',
  menu: 'menu',
  menuitem: 'menuitem',
  meta: 'meta',
  meter: 'meter',
  nav: 'nav',
  noscript: 'noscript',
  object: 'object',
  ol: 'ol',
  optgroup: 'optgroup',
  option: 'option',
  output: 'output',
  p: 'p',
  param: 'param',
  picture: 'picture',
  pre: 'pre',
  progress: 'progress',
  q: 'q',
  rp: 'rp',
  rt: 'rt',
  ruby: 'ruby',
  s: 's',
  samp: 'samp',
  script: 'script',
  section: 'section',
  select: 'select',
  small: 'small',
  source: 'source',
  span: 'span',
  strong: 'strong',
  style: 'style',
  sub: 'sub',
  summary: 'summary',
  sup: 'sup',
  table: 'table',
  tbody: 'tbody',
  td: 'td',
  textarea: 'textarea',
  tfoot: 'tfoot',
  th: 'th',
  thead: 'thead',
  time: 'time',
  title: 'title',
  tr: 'tr',
  track: 'track',
  u: 'u',
  ul: 'ul',
  'var': 'var',
  video: 'video',
  wbr: 'wbr',

  // SVG
  circle: 'circle',
  clipPath: 'clipPath',
  defs: 'defs',
  ellipse: 'ellipse',
  g: 'g',
  image: 'image',
  line: 'line',
  linearGradient: 'linearGradient',
  mask: 'mask',
  path: 'path',
  pattern: 'pattern',
  polygon: 'polygon',
  polyline: 'polyline',
  radialGradient: 'radialGradient',
  rect: 'rect',
  stop: 'stop',
  svg: 'svg',
  text: 'text',
  tspan: 'tspan'

}, createDOMFactory);

module.exports = ReactDOMFactories;
},{"./ReactElement":108,"./ReactElementValidator":109,"fbjs/lib/mapObject":205}],95:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMFeatureFlags
 */

'use strict';

var ReactDOMFeatureFlags = {
  useCreateElement: false
};

module.exports = ReactDOMFeatureFlags;
},{}],96:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMIDOperations
 * @typechecks static-only
 */

'use strict';

var DOMChildrenOperations = require('./DOMChildrenOperations');
var DOMPropertyOperations = require('./DOMPropertyOperations');
var ReactMount = require('./ReactMount');
var ReactPerf = require('./ReactPerf');

var invariant = require('fbjs/lib/invariant');

/**
 * Errors for properties that should not be updated with `updatePropertyByID()`.
 *
 * @type {object}
 * @private
 */
var INVALID_PROPERTY_ERRORS = {
  dangerouslySetInnerHTML: '`dangerouslySetInnerHTML` must be set using `updateInnerHTMLByID()`.',
  style: '`style` must be set using `updateStylesByID()`.'
};

/**
 * Operations used to process updates to DOM nodes.
 */
var ReactDOMIDOperations = {

  /**
   * Updates a DOM node with new property values. This should only be used to
   * update DOM properties in `DOMProperty`.
   *
   * @param {string} id ID of the node to update.
   * @param {string} name A valid property name, see `DOMProperty`.
   * @param {*} value New value of the property.
   * @internal
   */
  updatePropertyByID: function (id, name, value) {
    var node = ReactMount.getNode(id);
    !!INVALID_PROPERTY_ERRORS.hasOwnProperty(name) ? "production" !== 'production' ? invariant(false, 'updatePropertyByID(...): %s', INVALID_PROPERTY_ERRORS[name]) : invariant(false) : undefined;

    // If we're updating to null or undefined, we should remove the property
    // from the DOM node instead of inadvertantly setting to a string. This
    // brings us in line with the same behavior we have on initial render.
    if (value != null) {
      DOMPropertyOperations.setValueForProperty(node, name, value);
    } else {
      DOMPropertyOperations.deleteValueForProperty(node, name);
    }
  },

  /**
   * Replaces a DOM node that exists in the document with markup.
   *
   * @param {string} id ID of child to be replaced.
   * @param {string} markup Dangerous markup to inject in place of child.
   * @internal
   * @see {Danger.dangerouslyReplaceNodeWithMarkup}
   */
  dangerouslyReplaceNodeWithMarkupByID: function (id, markup) {
    var node = ReactMount.getNode(id);
    DOMChildrenOperations.dangerouslyReplaceNodeWithMarkup(node, markup);
  },

  /**
   * Updates a component's children by processing a series of updates.
   *
   * @param {array<object>} updates List of update configurations.
   * @param {array<string>} markup List of markup strings.
   * @internal
   */
  dangerouslyProcessChildrenUpdates: function (updates, markup) {
    for (var i = 0; i < updates.length; i++) {
      updates[i].parentNode = ReactMount.getNode(updates[i].parentID);
    }
    DOMChildrenOperations.processUpdates(updates, markup);
  }
};

ReactPerf.measureMethods(ReactDOMIDOperations, 'ReactDOMIDOperations', {
  dangerouslyReplaceNodeWithMarkupByID: 'dangerouslyReplaceNodeWithMarkupByID',
  dangerouslyProcessChildrenUpdates: 'dangerouslyProcessChildrenUpdates'
});

module.exports = ReactDOMIDOperations;
},{"./DOMChildrenOperations":64,"./DOMPropertyOperations":66,"./ReactMount":121,"./ReactPerf":127,"fbjs/lib/invariant":200}],97:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMInput
 */

'use strict';

var ReactDOMIDOperations = require('./ReactDOMIDOperations');
var LinkedValueUtils = require('./LinkedValueUtils');
var ReactMount = require('./ReactMount');
var ReactUpdates = require('./ReactUpdates');

var assign = require('./Object.assign');
var invariant = require('fbjs/lib/invariant');

var instancesByReactID = {};

function forceUpdateIfMounted() {
  if (this._rootNodeID) {
    // DOM component is still mounted; update
    ReactDOMInput.updateWrapper(this);
  }
}

/**
 * Implements an <input> native component that allows setting these optional
 * props: `checked`, `value`, `defaultChecked`, and `defaultValue`.
 *
 * If `checked` or `value` are not supplied (or null/undefined), user actions
 * that affect the checked state or value will trigger updates to the element.
 *
 * If they are supplied (and not null/undefined), the rendered element will not
 * trigger updates to the element. Instead, the props must change in order for
 * the rendered element to be updated.
 *
 * The rendered element will be initialized as unchecked (or `defaultChecked`)
 * with an empty value (or `defaultValue`).
 *
 * @see http://www.w3.org/TR/2012/WD-html5-20121025/the-input-element.html
 */
var ReactDOMInput = {
  getNativeProps: function (inst, props, context) {
    var value = LinkedValueUtils.getValue(props);
    var checked = LinkedValueUtils.getChecked(props);

    var nativeProps = assign({}, props, {
      defaultChecked: undefined,
      defaultValue: undefined,
      value: value != null ? value : inst._wrapperState.initialValue,
      checked: checked != null ? checked : inst._wrapperState.initialChecked,
      onChange: inst._wrapperState.onChange
    });

    return nativeProps;
  },

  mountWrapper: function (inst, props) {
    if ("production" !== 'production') {
      LinkedValueUtils.checkPropTypes('input', props, inst._currentElement._owner);
    }

    var defaultValue = props.defaultValue;
    inst._wrapperState = {
      initialChecked: props.defaultChecked || false,
      initialValue: defaultValue != null ? defaultValue : null,
      onChange: _handleChange.bind(inst)
    };
  },

  mountReadyWrapper: function (inst) {
    // Can't be in mountWrapper or else server rendering leaks.
    instancesByReactID[inst._rootNodeID] = inst;
  },

  unmountWrapper: function (inst) {
    delete instancesByReactID[inst._rootNodeID];
  },

  updateWrapper: function (inst) {
    var props = inst._currentElement.props;

    // TODO: Shouldn't this be getChecked(props)?
    var checked = props.checked;
    if (checked != null) {
      ReactDOMIDOperations.updatePropertyByID(inst._rootNodeID, 'checked', checked || false);
    }

    var value = LinkedValueUtils.getValue(props);
    if (value != null) {
      // Cast `value` to a string to ensure the value is set correctly. While
      // browsers typically do this as necessary, jsdom doesn't.
      ReactDOMIDOperations.updatePropertyByID(inst._rootNodeID, 'value', '' + value);
    }
  }
};

function _handleChange(event) {
  var props = this._currentElement.props;

  var returnValue = LinkedValueUtils.executeOnChange(props, event);

  // Here we use asap to wait until all updates have propagated, which
  // is important when using controlled components within layers:
  // https://github.com/facebook/react/issues/1698
  ReactUpdates.asap(forceUpdateIfMounted, this);

  var name = props.name;
  if (props.type === 'radio' && name != null) {
    var rootNode = ReactMount.getNode(this._rootNodeID);
    var queryRoot = rootNode;

    while (queryRoot.parentNode) {
      queryRoot = queryRoot.parentNode;
    }

    // If `rootNode.form` was non-null, then we could try `form.elements`,
    // but that sometimes behaves strangely in IE8. We could also try using
    // `form.getElementsByName`, but that will only return direct children
    // and won't include inputs that use the HTML5 `form=` attribute. Since
    // the input might not even be in a form, let's just use the global
    // `querySelectorAll` to ensure we don't miss anything.
    var group = queryRoot.querySelectorAll('input[name=' + JSON.stringify('' + name) + '][type="radio"]');

    for (var i = 0; i < group.length; i++) {
      var otherNode = group[i];
      if (otherNode === rootNode || otherNode.form !== rootNode.form) {
        continue;
      }
      // This will throw if radio buttons rendered by different copies of React
      // and the same name are rendered into the same form (same as #1939).
      // That's probably okay; we don't support it just as we don't support
      // mixing React with non-React.
      var otherID = ReactMount.getID(otherNode);
      !otherID ? "production" !== 'production' ? invariant(false, 'ReactDOMInput: Mixing React and non-React radio inputs with the ' + 'same `name` is not supported.') : invariant(false) : undefined;
      var otherInstance = instancesByReactID[otherID];
      !otherInstance ? "production" !== 'production' ? invariant(false, 'ReactDOMInput: Unknown radio button ID %s.', otherID) : invariant(false) : undefined;
      // If this is a controlled radio button group, forcing the input that
      // was previously checked to update will cause it to be come re-checked
      // as appropriate.
      ReactUpdates.asap(forceUpdateIfMounted, otherInstance);
    }
  }

  return returnValue;
}

module.exports = ReactDOMInput;
},{"./LinkedValueUtils":77,"./Object.assign":78,"./ReactDOMIDOperations":96,"./ReactMount":121,"./ReactUpdates":139,"fbjs/lib/invariant":200}],98:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMOption
 */

'use strict';

var ReactChildren = require('./ReactChildren');
var ReactDOMSelect = require('./ReactDOMSelect');

var assign = require('./Object.assign');
var warning = require('fbjs/lib/warning');

var valueContextKey = ReactDOMSelect.valueContextKey;

/**
 * Implements an <option> native component that warns when `selected` is set.
 */
var ReactDOMOption = {
  mountWrapper: function (inst, props, context) {
    // TODO (yungsters): Remove support for `selected` in <option>.
    if ("production" !== 'production') {
      "production" !== 'production' ? warning(props.selected == null, 'Use the `defaultValue` or `value` props on <select> instead of ' + 'setting `selected` on <option>.') : undefined;
    }

    // Look up whether this option is 'selected' via context
    var selectValue = context[valueContextKey];

    // If context key is null (e.g., no specified value or after initial mount)
    // or missing (e.g., for <datalist>), we don't change props.selected
    var selected = null;
    if (selectValue != null) {
      selected = false;
      if (Array.isArray(selectValue)) {
        // multiple
        for (var i = 0; i < selectValue.length; i++) {
          if ('' + selectValue[i] === '' + props.value) {
            selected = true;
            break;
          }
        }
      } else {
        selected = '' + selectValue === '' + props.value;
      }
    }

    inst._wrapperState = { selected: selected };
  },

  getNativeProps: function (inst, props, context) {
    var nativeProps = assign({ selected: undefined, children: undefined }, props);

    // Read state only from initial mount because <select> updates value
    // manually; we need the initial state only for server rendering
    if (inst._wrapperState.selected != null) {
      nativeProps.selected = inst._wrapperState.selected;
    }

    var content = '';

    // Flatten children and warn if they aren't strings or numbers;
    // invalid types are ignored.
    ReactChildren.forEach(props.children, function (child) {
      if (child == null) {
        return;
      }
      if (typeof child === 'string' || typeof child === 'number') {
        content += child;
      } else {
        "production" !== 'production' ? warning(false, 'Only strings and numbers are supported as <option> children.') : undefined;
      }
    });

    if (content) {
      nativeProps.children = content;
    }

    return nativeProps;
  }

};

module.exports = ReactDOMOption;
},{"./Object.assign":78,"./ReactChildren":84,"./ReactDOMSelect":99,"fbjs/lib/warning":211}],99:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMSelect
 */

'use strict';

var LinkedValueUtils = require('./LinkedValueUtils');
var ReactMount = require('./ReactMount');
var ReactUpdates = require('./ReactUpdates');

var assign = require('./Object.assign');
var warning = require('fbjs/lib/warning');

var valueContextKey = '__ReactDOMSelect_value$' + Math.random().toString(36).slice(2);

function updateOptionsIfPendingUpdateAndMounted() {
  if (this._rootNodeID && this._wrapperState.pendingUpdate) {
    this._wrapperState.pendingUpdate = false;

    var props = this._currentElement.props;
    var value = LinkedValueUtils.getValue(props);

    if (value != null) {
      updateOptions(this, Boolean(props.multiple), value);
    }
  }
}

function getDeclarationErrorAddendum(owner) {
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

var valuePropNames = ['value', 'defaultValue'];

/**
 * Validation function for `value` and `defaultValue`.
 * @private
 */
function checkSelectPropTypes(inst, props) {
  var owner = inst._currentElement._owner;
  LinkedValueUtils.checkPropTypes('select', props, owner);

  for (var i = 0; i < valuePropNames.length; i++) {
    var propName = valuePropNames[i];
    if (props[propName] == null) {
      continue;
    }
    if (props.multiple) {
      "production" !== 'production' ? warning(Array.isArray(props[propName]), 'The `%s` prop supplied to <select> must be an array if ' + '`multiple` is true.%s', propName, getDeclarationErrorAddendum(owner)) : undefined;
    } else {
      "production" !== 'production' ? warning(!Array.isArray(props[propName]), 'The `%s` prop supplied to <select> must be a scalar ' + 'value if `multiple` is false.%s', propName, getDeclarationErrorAddendum(owner)) : undefined;
    }
  }
}

/**
 * @param {ReactDOMComponent} inst
 * @param {boolean} multiple
 * @param {*} propValue A stringable (with `multiple`, a list of stringables).
 * @private
 */
function updateOptions(inst, multiple, propValue) {
  var selectedValue, i;
  var options = ReactMount.getNode(inst._rootNodeID).options;

  if (multiple) {
    selectedValue = {};
    for (i = 0; i < propValue.length; i++) {
      selectedValue['' + propValue[i]] = true;
    }
    for (i = 0; i < options.length; i++) {
      var selected = selectedValue.hasOwnProperty(options[i].value);
      if (options[i].selected !== selected) {
        options[i].selected = selected;
      }
    }
  } else {
    // Do not set `select.value` as exact behavior isn't consistent across all
    // browsers for all cases.
    selectedValue = '' + propValue;
    for (i = 0; i < options.length; i++) {
      if (options[i].value === selectedValue) {
        options[i].selected = true;
        return;
      }
    }
    if (options.length) {
      options[0].selected = true;
    }
  }
}

/**
 * Implements a <select> native component that allows optionally setting the
 * props `value` and `defaultValue`. If `multiple` is false, the prop must be a
 * stringable. If `multiple` is true, the prop must be an array of stringables.
 *
 * If `value` is not supplied (or null/undefined), user actions that change the
 * selected option will trigger updates to the rendered options.
 *
 * If it is supplied (and not null/undefined), the rendered options will not
 * update in response to user actions. Instead, the `value` prop must change in
 * order for the rendered options to update.
 *
 * If `defaultValue` is provided, any options with the supplied values will be
 * selected.
 */
var ReactDOMSelect = {
  valueContextKey: valueContextKey,

  getNativeProps: function (inst, props, context) {
    return assign({}, props, {
      onChange: inst._wrapperState.onChange,
      value: undefined
    });
  },

  mountWrapper: function (inst, props) {
    if ("production" !== 'production') {
      checkSelectPropTypes(inst, props);
    }

    var value = LinkedValueUtils.getValue(props);
    inst._wrapperState = {
      pendingUpdate: false,
      initialValue: value != null ? value : props.defaultValue,
      onChange: _handleChange.bind(inst),
      wasMultiple: Boolean(props.multiple)
    };
  },

  processChildContext: function (inst, props, context) {
    // Pass down initial value so initial generated markup has correct
    // `selected` attributes
    var childContext = assign({}, context);
    childContext[valueContextKey] = inst._wrapperState.initialValue;
    return childContext;
  },

  postUpdateWrapper: function (inst) {
    var props = inst._currentElement.props;

    // After the initial mount, we control selected-ness manually so don't pass
    // the context value down
    inst._wrapperState.initialValue = undefined;

    var wasMultiple = inst._wrapperState.wasMultiple;
    inst._wrapperState.wasMultiple = Boolean(props.multiple);

    var value = LinkedValueUtils.getValue(props);
    if (value != null) {
      inst._wrapperState.pendingUpdate = false;
      updateOptions(inst, Boolean(props.multiple), value);
    } else if (wasMultiple !== Boolean(props.multiple)) {
      // For simplicity, reapply `defaultValue` if `multiple` is toggled.
      if (props.defaultValue != null) {
        updateOptions(inst, Boolean(props.multiple), props.defaultValue);
      } else {
        // Revert the select back to its default unselected state.
        updateOptions(inst, Boolean(props.multiple), props.multiple ? [] : '');
      }
    }
  }
};

function _handleChange(event) {
  var props = this._currentElement.props;
  var returnValue = LinkedValueUtils.executeOnChange(props, event);

  this._wrapperState.pendingUpdate = true;
  ReactUpdates.asap(updateOptionsIfPendingUpdateAndMounted, this);
  return returnValue;
}

module.exports = ReactDOMSelect;
},{"./LinkedValueUtils":77,"./Object.assign":78,"./ReactMount":121,"./ReactUpdates":139,"fbjs/lib/warning":211}],100:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMSelection
 */

'use strict';

var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');

var getNodeForCharacterOffset = require('./getNodeForCharacterOffset');
var getTextContentAccessor = require('./getTextContentAccessor');

/**
 * While `isCollapsed` is available on the Selection object and `collapsed`
 * is available on the Range object, IE11 sometimes gets them wrong.
 * If the anchor/focus nodes and offsets are the same, the range is collapsed.
 */
function isCollapsed(anchorNode, anchorOffset, focusNode, focusOffset) {
  return anchorNode === focusNode && anchorOffset === focusOffset;
}

/**
 * Get the appropriate anchor and focus node/offset pairs for IE.
 *
 * The catch here is that IE's selection API doesn't provide information
 * about whether the selection is forward or backward, so we have to
 * behave as though it's always forward.
 *
 * IE text differs from modern selection in that it behaves as though
 * block elements end with a new line. This means character offsets will
 * differ between the two APIs.
 *
 * @param {DOMElement} node
 * @return {object}
 */
function getIEOffsets(node) {
  var selection = document.selection;
  var selectedRange = selection.createRange();
  var selectedLength = selectedRange.text.length;

  // Duplicate selection so we can move range without breaking user selection.
  var fromStart = selectedRange.duplicate();
  fromStart.moveToElementText(node);
  fromStart.setEndPoint('EndToStart', selectedRange);

  var startOffset = fromStart.text.length;
  var endOffset = startOffset + selectedLength;

  return {
    start: startOffset,
    end: endOffset
  };
}

/**
 * @param {DOMElement} node
 * @return {?object}
 */
function getModernOffsets(node) {
  var selection = window.getSelection && window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  var anchorNode = selection.anchorNode;
  var anchorOffset = selection.anchorOffset;
  var focusNode = selection.focusNode;
  var focusOffset = selection.focusOffset;

  var currentRange = selection.getRangeAt(0);

  // In Firefox, range.startContainer and range.endContainer can be "anonymous
  // divs", e.g. the up/down buttons on an <input type="number">. Anonymous
  // divs do not seem to expose properties, triggering a "Permission denied
  // error" if any of its properties are accessed. The only seemingly possible
  // way to avoid erroring is to access a property that typically works for
  // non-anonymous divs and catch any error that may otherwise arise. See
  // https://bugzilla.mozilla.org/show_bug.cgi?id=208427
  try {
    /* eslint-disable no-unused-expressions */
    currentRange.startContainer.nodeType;
    currentRange.endContainer.nodeType;
    /* eslint-enable no-unused-expressions */
  } catch (e) {
    return null;
  }

  // If the node and offset values are the same, the selection is collapsed.
  // `Selection.isCollapsed` is available natively, but IE sometimes gets
  // this value wrong.
  var isSelectionCollapsed = isCollapsed(selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset);

  var rangeLength = isSelectionCollapsed ? 0 : currentRange.toString().length;

  var tempRange = currentRange.cloneRange();
  tempRange.selectNodeContents(node);
  tempRange.setEnd(currentRange.startContainer, currentRange.startOffset);

  var isTempRangeCollapsed = isCollapsed(tempRange.startContainer, tempRange.startOffset, tempRange.endContainer, tempRange.endOffset);

  var start = isTempRangeCollapsed ? 0 : tempRange.toString().length;
  var end = start + rangeLength;

  // Detect whether the selection is backward.
  var detectionRange = document.createRange();
  detectionRange.setStart(anchorNode, anchorOffset);
  detectionRange.setEnd(focusNode, focusOffset);
  var isBackward = detectionRange.collapsed;

  return {
    start: isBackward ? end : start,
    end: isBackward ? start : end
  };
}

/**
 * @param {DOMElement|DOMTextNode} node
 * @param {object} offsets
 */
function setIEOffsets(node, offsets) {
  var range = document.selection.createRange().duplicate();
  var start, end;

  if (typeof offsets.end === 'undefined') {
    start = offsets.start;
    end = start;
  } else if (offsets.start > offsets.end) {
    start = offsets.end;
    end = offsets.start;
  } else {
    start = offsets.start;
    end = offsets.end;
  }

  range.moveToElementText(node);
  range.moveStart('character', start);
  range.setEndPoint('EndToStart', range);
  range.moveEnd('character', end - start);
  range.select();
}

/**
 * In modern non-IE browsers, we can support both forward and backward
 * selections.
 *
 * Note: IE10+ supports the Selection object, but it does not support
 * the `extend` method, which means that even in modern IE, it's not possible
 * to programatically create a backward selection. Thus, for all IE
 * versions, we use the old IE API to create our selections.
 *
 * @param {DOMElement|DOMTextNode} node
 * @param {object} offsets
 */
function setModernOffsets(node, offsets) {
  if (!window.getSelection) {
    return;
  }

  var selection = window.getSelection();
  var length = node[getTextContentAccessor()].length;
  var start = Math.min(offsets.start, length);
  var end = typeof offsets.end === 'undefined' ? start : Math.min(offsets.end, length);

  // IE 11 uses modern selection, but doesn't support the extend method.
  // Flip backward selections, so we can set with a single range.
  if (!selection.extend && start > end) {
    var temp = end;
    end = start;
    start = temp;
  }

  var startMarker = getNodeForCharacterOffset(node, start);
  var endMarker = getNodeForCharacterOffset(node, end);

  if (startMarker && endMarker) {
    var range = document.createRange();
    range.setStart(startMarker.node, startMarker.offset);
    selection.removeAllRanges();

    if (start > end) {
      selection.addRange(range);
      selection.extend(endMarker.node, endMarker.offset);
    } else {
      range.setEnd(endMarker.node, endMarker.offset);
      selection.addRange(range);
    }
  }
}

var useIEOffsets = ExecutionEnvironment.canUseDOM && 'selection' in document && !('getSelection' in window);

var ReactDOMSelection = {
  /**
   * @param {DOMElement} node
   */
  getOffsets: useIEOffsets ? getIEOffsets : getModernOffsets,

  /**
   * @param {DOMElement|DOMTextNode} node
   * @param {object} offsets
   */
  setOffsets: useIEOffsets ? setIEOffsets : setModernOffsets
};

module.exports = ReactDOMSelection;
},{"./getNodeForCharacterOffset":172,"./getTextContentAccessor":173,"fbjs/lib/ExecutionEnvironment":186}],101:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMServer
 */

'use strict';

var ReactDefaultInjection = require('./ReactDefaultInjection');
var ReactServerRendering = require('./ReactServerRendering');
var ReactVersion = require('./ReactVersion');

ReactDefaultInjection.inject();

var ReactDOMServer = {
  renderToString: ReactServerRendering.renderToString,
  renderToStaticMarkup: ReactServerRendering.renderToStaticMarkup,
  version: ReactVersion
};

module.exports = ReactDOMServer;
},{"./ReactDefaultInjection":105,"./ReactServerRendering":136,"./ReactVersion":140}],102:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMTextComponent
 * @typechecks static-only
 */

'use strict';

var DOMChildrenOperations = require('./DOMChildrenOperations');
var DOMPropertyOperations = require('./DOMPropertyOperations');
var ReactComponentBrowserEnvironment = require('./ReactComponentBrowserEnvironment');
var ReactMount = require('./ReactMount');

var assign = require('./Object.assign');
var escapeTextContentForBrowser = require('./escapeTextContentForBrowser');
var setTextContent = require('./setTextContent');
var validateDOMNesting = require('./validateDOMNesting');

/**
 * Text nodes violate a couple assumptions that React makes about components:
 *
 *  - When mounting text into the DOM, adjacent text nodes are merged.
 *  - Text nodes cannot be assigned a React root ID.
 *
 * This component is used to wrap strings in elements so that they can undergo
 * the same reconciliation that is applied to elements.
 *
 * TODO: Investigate representing React components in the DOM with text nodes.
 *
 * @class ReactDOMTextComponent
 * @extends ReactComponent
 * @internal
 */
var ReactDOMTextComponent = function (props) {
  // This constructor and its argument is currently used by mocks.
};

assign(ReactDOMTextComponent.prototype, {

  /**
   * @param {ReactText} text
   * @internal
   */
  construct: function (text) {
    // TODO: This is really a ReactText (ReactNode), not a ReactElement
    this._currentElement = text;
    this._stringText = '' + text;

    // Properties
    this._rootNodeID = null;
    this._mountIndex = 0;
  },

  /**
   * Creates the markup for this text node. This node is not intended to have
   * any features besides containing text content.
   *
   * @param {string} rootID DOM ID of the root node.
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @return {string} Markup for this text node.
   * @internal
   */
  mountComponent: function (rootID, transaction, context) {
    if ("production" !== 'production') {
      if (context[validateDOMNesting.ancestorInfoContextKey]) {
        validateDOMNesting('span', null, context[validateDOMNesting.ancestorInfoContextKey]);
      }
    }

    this._rootNodeID = rootID;
    if (transaction.useCreateElement) {
      var ownerDocument = context[ReactMount.ownerDocumentContextKey];
      var el = ownerDocument.createElement('span');
      DOMPropertyOperations.setAttributeForID(el, rootID);
      // Populate node cache
      ReactMount.getID(el);
      setTextContent(el, this._stringText);
      return el;
    } else {
      var escapedText = escapeTextContentForBrowser(this._stringText);

      if (transaction.renderToStaticMarkup) {
        // Normally we'd wrap this in a `span` for the reasons stated above, but
        // since this is a situation where React won't take over (static pages),
        // we can simply return the text as it is.
        return escapedText;
      }

      return '<span ' + DOMPropertyOperations.createMarkupForID(rootID) + '>' + escapedText + '</span>';
    }
  },

  /**
   * Updates this component by updating the text content.
   *
   * @param {ReactText} nextText The next text content
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  receiveComponent: function (nextText, transaction) {
    if (nextText !== this._currentElement) {
      this._currentElement = nextText;
      var nextStringText = '' + nextText;
      if (nextStringText !== this._stringText) {
        // TODO: Save this as pending props and use performUpdateIfNecessary
        // and/or updateComponent to do the actual update for consistency with
        // other component types?
        this._stringText = nextStringText;
        var node = ReactMount.getNode(this._rootNodeID);
        DOMChildrenOperations.updateTextContent(node, nextStringText);
      }
    }
  },

  unmountComponent: function () {
    ReactComponentBrowserEnvironment.unmountIDFromEnvironment(this._rootNodeID);
  }

});

module.exports = ReactDOMTextComponent;
},{"./DOMChildrenOperations":64,"./DOMPropertyOperations":66,"./Object.assign":78,"./ReactComponentBrowserEnvironment":87,"./ReactMount":121,"./escapeTextContentForBrowser":163,"./setTextContent":181,"./validateDOMNesting":184}],103:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMTextarea
 */

'use strict';

var LinkedValueUtils = require('./LinkedValueUtils');
var ReactDOMIDOperations = require('./ReactDOMIDOperations');
var ReactUpdates = require('./ReactUpdates');

var assign = require('./Object.assign');
var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

function forceUpdateIfMounted() {
  if (this._rootNodeID) {
    // DOM component is still mounted; update
    ReactDOMTextarea.updateWrapper(this);
  }
}

/**
 * Implements a <textarea> native component that allows setting `value`, and
 * `defaultValue`. This differs from the traditional DOM API because value is
 * usually set as PCDATA children.
 *
 * If `value` is not supplied (or null/undefined), user actions that affect the
 * value will trigger updates to the element.
 *
 * If `value` is supplied (and not null/undefined), the rendered element will
 * not trigger updates to the element. Instead, the `value` prop must change in
 * order for the rendered element to be updated.
 *
 * The rendered element will be initialized with an empty value, the prop
 * `defaultValue` if specified, or the children content (deprecated).
 */
var ReactDOMTextarea = {
  getNativeProps: function (inst, props, context) {
    !(props.dangerouslySetInnerHTML == null) ? "production" !== 'production' ? invariant(false, '`dangerouslySetInnerHTML` does not make sense on <textarea>.') : invariant(false) : undefined;

    // Always set children to the same thing. In IE9, the selection range will
    // get reset if `textContent` is mutated.
    var nativeProps = assign({}, props, {
      defaultValue: undefined,
      value: undefined,
      children: inst._wrapperState.initialValue,
      onChange: inst._wrapperState.onChange
    });

    return nativeProps;
  },

  mountWrapper: function (inst, props) {
    if ("production" !== 'production') {
      LinkedValueUtils.checkPropTypes('textarea', props, inst._currentElement._owner);
    }

    var defaultValue = props.defaultValue;
    // TODO (yungsters): Remove support for children content in <textarea>.
    var children = props.children;
    if (children != null) {
      if ("production" !== 'production') {
        "production" !== 'production' ? warning(false, 'Use the `defaultValue` or `value` props instead of setting ' + 'children on <textarea>.') : undefined;
      }
      !(defaultValue == null) ? "production" !== 'production' ? invariant(false, 'If you supply `defaultValue` on a <textarea>, do not pass children.') : invariant(false) : undefined;
      if (Array.isArray(children)) {
        !(children.length <= 1) ? "production" !== 'production' ? invariant(false, '<textarea> can only have at most one child.') : invariant(false) : undefined;
        children = children[0];
      }

      defaultValue = '' + children;
    }
    if (defaultValue == null) {
      defaultValue = '';
    }
    var value = LinkedValueUtils.getValue(props);

    inst._wrapperState = {
      // We save the initial value so that `ReactDOMComponent` doesn't update
      // `textContent` (unnecessary since we update value).
      // The initial value can be a boolean or object so that's why it's
      // forced to be a string.
      initialValue: '' + (value != null ? value : defaultValue),
      onChange: _handleChange.bind(inst)
    };
  },

  updateWrapper: function (inst) {
    var props = inst._currentElement.props;
    var value = LinkedValueUtils.getValue(props);
    if (value != null) {
      // Cast `value` to a string to ensure the value is set correctly. While
      // browsers typically do this as necessary, jsdom doesn't.
      ReactDOMIDOperations.updatePropertyByID(inst._rootNodeID, 'value', '' + value);
    }
  }
};

function _handleChange(event) {
  var props = this._currentElement.props;
  var returnValue = LinkedValueUtils.executeOnChange(props, event);
  ReactUpdates.asap(forceUpdateIfMounted, this);
  return returnValue;
}

module.exports = ReactDOMTextarea;
},{"./LinkedValueUtils":77,"./Object.assign":78,"./ReactDOMIDOperations":96,"./ReactUpdates":139,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],104:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultBatchingStrategy
 */

'use strict';

var ReactUpdates = require('./ReactUpdates');
var Transaction = require('./Transaction');

var assign = require('./Object.assign');
var emptyFunction = require('fbjs/lib/emptyFunction');

var RESET_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: function () {
    ReactDefaultBatchingStrategy.isBatchingUpdates = false;
  }
};

var FLUSH_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)
};

var TRANSACTION_WRAPPERS = [FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES];

function ReactDefaultBatchingStrategyTransaction() {
  this.reinitializeTransaction();
}

assign(ReactDefaultBatchingStrategyTransaction.prototype, Transaction.Mixin, {
  getTransactionWrappers: function () {
    return TRANSACTION_WRAPPERS;
  }
});

var transaction = new ReactDefaultBatchingStrategyTransaction();

var ReactDefaultBatchingStrategy = {
  isBatchingUpdates: false,

  /**
   * Call the provided function in a context within which calls to `setState`
   * and friends are batched such that components aren't updated unnecessarily.
   */
  batchedUpdates: function (callback, a, b, c, d, e) {
    var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;

    ReactDefaultBatchingStrategy.isBatchingUpdates = true;

    // The code is written this way to avoid extra allocations
    if (alreadyBatchingUpdates) {
      callback(a, b, c, d, e);
    } else {
      transaction.perform(callback, null, a, b, c, d, e);
    }
  }
};

module.exports = ReactDefaultBatchingStrategy;
},{"./Object.assign":78,"./ReactUpdates":139,"./Transaction":156,"fbjs/lib/emptyFunction":192}],105:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultInjection
 */

'use strict';

var BeforeInputEventPlugin = require('./BeforeInputEventPlugin');
var ChangeEventPlugin = require('./ChangeEventPlugin');
var ClientReactRootIndex = require('./ClientReactRootIndex');
var DefaultEventPluginOrder = require('./DefaultEventPluginOrder');
var EnterLeaveEventPlugin = require('./EnterLeaveEventPlugin');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');
var HTMLDOMPropertyConfig = require('./HTMLDOMPropertyConfig');
var ReactBrowserComponentMixin = require('./ReactBrowserComponentMixin');
var ReactComponentBrowserEnvironment = require('./ReactComponentBrowserEnvironment');
var ReactDefaultBatchingStrategy = require('./ReactDefaultBatchingStrategy');
var ReactDOMComponent = require('./ReactDOMComponent');
var ReactDOMTextComponent = require('./ReactDOMTextComponent');
var ReactEventListener = require('./ReactEventListener');
var ReactInjection = require('./ReactInjection');
var ReactInstanceHandles = require('./ReactInstanceHandles');
var ReactMount = require('./ReactMount');
var ReactReconcileTransaction = require('./ReactReconcileTransaction');
var SelectEventPlugin = require('./SelectEventPlugin');
var ServerReactRootIndex = require('./ServerReactRootIndex');
var SimpleEventPlugin = require('./SimpleEventPlugin');
var SVGDOMPropertyConfig = require('./SVGDOMPropertyConfig');

var alreadyInjected = false;

function inject() {
  if (alreadyInjected) {
    // TODO: This is currently true because these injections are shared between
    // the client and the server package. They should be built independently
    // and not share any injection state. Then this problem will be solved.
    return;
  }
  alreadyInjected = true;

  ReactInjection.EventEmitter.injectReactEventListener(ReactEventListener);

  /**
   * Inject modules for resolving DOM hierarchy and plugin ordering.
   */
  ReactInjection.EventPluginHub.injectEventPluginOrder(DefaultEventPluginOrder);
  ReactInjection.EventPluginHub.injectInstanceHandle(ReactInstanceHandles);
  ReactInjection.EventPluginHub.injectMount(ReactMount);

  /**
   * Some important event plugins included by default (without having to require
   * them).
   */
  ReactInjection.EventPluginHub.injectEventPluginsByName({
    SimpleEventPlugin: SimpleEventPlugin,
    EnterLeaveEventPlugin: EnterLeaveEventPlugin,
    ChangeEventPlugin: ChangeEventPlugin,
    SelectEventPlugin: SelectEventPlugin,
    BeforeInputEventPlugin: BeforeInputEventPlugin
  });

  ReactInjection.NativeComponent.injectGenericComponentClass(ReactDOMComponent);

  ReactInjection.NativeComponent.injectTextComponentClass(ReactDOMTextComponent);

  ReactInjection.Class.injectMixin(ReactBrowserComponentMixin);

  ReactInjection.DOMProperty.injectDOMPropertyConfig(HTMLDOMPropertyConfig);
  ReactInjection.DOMProperty.injectDOMPropertyConfig(SVGDOMPropertyConfig);

  ReactInjection.EmptyComponent.injectEmptyComponent('noscript');

  ReactInjection.Updates.injectReconcileTransaction(ReactReconcileTransaction);
  ReactInjection.Updates.injectBatchingStrategy(ReactDefaultBatchingStrategy);

  ReactInjection.RootIndex.injectCreateReactRootIndex(ExecutionEnvironment.canUseDOM ? ClientReactRootIndex.createReactRootIndex : ServerReactRootIndex.createReactRootIndex);

  ReactInjection.Component.injectEnvironment(ReactComponentBrowserEnvironment);

  if ("production" !== 'production') {
    var url = ExecutionEnvironment.canUseDOM && window.location.href || '';
    if (/[?&]react_perf\b/.test(url)) {
      var ReactDefaultPerf = require('./ReactDefaultPerf');
      ReactDefaultPerf.start();
    }
  }
}

module.exports = {
  inject: inject
};
},{"./BeforeInputEventPlugin":58,"./ChangeEventPlugin":62,"./ClientReactRootIndex":63,"./DefaultEventPluginOrder":68,"./EnterLeaveEventPlugin":69,"./HTMLDOMPropertyConfig":76,"./ReactBrowserComponentMixin":81,"./ReactComponentBrowserEnvironment":87,"./ReactDOMComponent":93,"./ReactDOMTextComponent":102,"./ReactDefaultBatchingStrategy":104,"./ReactDefaultPerf":106,"./ReactEventListener":114,"./ReactInjection":115,"./ReactInstanceHandles":117,"./ReactMount":121,"./ReactReconcileTransaction":131,"./SVGDOMPropertyConfig":141,"./SelectEventPlugin":142,"./ServerReactRootIndex":143,"./SimpleEventPlugin":144,"fbjs/lib/ExecutionEnvironment":186}],106:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultPerf
 * @typechecks static-only
 */

'use strict';

var DOMProperty = require('./DOMProperty');
var ReactDefaultPerfAnalysis = require('./ReactDefaultPerfAnalysis');
var ReactMount = require('./ReactMount');
var ReactPerf = require('./ReactPerf');

var performanceNow = require('fbjs/lib/performanceNow');

function roundFloat(val) {
  return Math.floor(val * 100) / 100;
}

function addValue(obj, key, val) {
  obj[key] = (obj[key] || 0) + val;
}

var ReactDefaultPerf = {
  _allMeasurements: [], // last item in the list is the current one
  _mountStack: [0],
  _injected: false,

  start: function () {
    if (!ReactDefaultPerf._injected) {
      ReactPerf.injection.injectMeasure(ReactDefaultPerf.measure);
    }

    ReactDefaultPerf._allMeasurements.length = 0;
    ReactPerf.enableMeasure = true;
  },

  stop: function () {
    ReactPerf.enableMeasure = false;
  },

  getLastMeasurements: function () {
    return ReactDefaultPerf._allMeasurements;
  },

  printExclusive: function (measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getExclusiveSummary(measurements);
    console.table(summary.map(function (item) {
      return {
        'Component class name': item.componentName,
        'Total inclusive time (ms)': roundFloat(item.inclusive),
        'Exclusive mount time (ms)': roundFloat(item.exclusive),
        'Exclusive render time (ms)': roundFloat(item.render),
        'Mount time per instance (ms)': roundFloat(item.exclusive / item.count),
        'Render time per instance (ms)': roundFloat(item.render / item.count),
        'Instances': item.count
      };
    }));
    // TODO: ReactDefaultPerfAnalysis.getTotalTime() does not return the correct
    // number.
  },

  printInclusive: function (measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getInclusiveSummary(measurements);
    console.table(summary.map(function (item) {
      return {
        'Owner > component': item.componentName,
        'Inclusive time (ms)': roundFloat(item.time),
        'Instances': item.count
      };
    }));
    console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
  },

  getMeasurementsSummaryMap: function (measurements) {
    var summary = ReactDefaultPerfAnalysis.getInclusiveSummary(measurements, true);
    return summary.map(function (item) {
      return {
        'Owner > component': item.componentName,
        'Wasted time (ms)': item.time,
        'Instances': item.count
      };
    });
  },

  printWasted: function (measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    console.table(ReactDefaultPerf.getMeasurementsSummaryMap(measurements));
    console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
  },

  printDOM: function (measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getDOMSummary(measurements);
    console.table(summary.map(function (item) {
      var result = {};
      result[DOMProperty.ID_ATTRIBUTE_NAME] = item.id;
      result.type = item.type;
      result.args = JSON.stringify(item.args);
      return result;
    }));
    console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
  },

  _recordWrite: function (id, fnName, totalTime, args) {
    // TODO: totalTime isn't that useful since it doesn't count paints/reflows
    var writes = ReactDefaultPerf._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1].writes;
    writes[id] = writes[id] || [];
    writes[id].push({
      type: fnName,
      time: totalTime,
      args: args
    });
  },

  measure: function (moduleName, fnName, func) {
    return function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      var totalTime;
      var rv;
      var start;

      if (fnName === '_renderNewRootComponent' || fnName === 'flushBatchedUpdates') {
        // A "measurement" is a set of metrics recorded for each flush. We want
        // to group the metrics for a given flush together so we can look at the
        // components that rendered and the DOM operations that actually
        // happened to determine the amount of "wasted work" performed.
        ReactDefaultPerf._allMeasurements.push({
          exclusive: {},
          inclusive: {},
          render: {},
          counts: {},
          writes: {},
          displayNames: {},
          totalTime: 0,
          created: {}
        });
        start = performanceNow();
        rv = func.apply(this, args);
        ReactDefaultPerf._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1].totalTime = performanceNow() - start;
        return rv;
      } else if (fnName === '_mountImageIntoNode' || moduleName === 'ReactBrowserEventEmitter' || moduleName === 'ReactDOMIDOperations' || moduleName === 'CSSPropertyOperations' || moduleName === 'DOMChildrenOperations' || moduleName === 'DOMPropertyOperations') {
        start = performanceNow();
        rv = func.apply(this, args);
        totalTime = performanceNow() - start;

        if (fnName === '_mountImageIntoNode') {
          var mountID = ReactMount.getID(args[1]);
          ReactDefaultPerf._recordWrite(mountID, fnName, totalTime, args[0]);
        } else if (fnName === 'dangerouslyProcessChildrenUpdates') {
          // special format
          args[0].forEach(function (update) {
            var writeArgs = {};
            if (update.fromIndex !== null) {
              writeArgs.fromIndex = update.fromIndex;
            }
            if (update.toIndex !== null) {
              writeArgs.toIndex = update.toIndex;
            }
            if (update.textContent !== null) {
              writeArgs.textContent = update.textContent;
            }
            if (update.markupIndex !== null) {
              writeArgs.markup = args[1][update.markupIndex];
            }
            ReactDefaultPerf._recordWrite(update.parentID, update.type, totalTime, writeArgs);
          });
        } else {
          // basic format
          var id = args[0];
          if (typeof id === 'object') {
            id = ReactMount.getID(args[0]);
          }
          ReactDefaultPerf._recordWrite(id, fnName, totalTime, Array.prototype.slice.call(args, 1));
        }
        return rv;
      } else if (moduleName === 'ReactCompositeComponent' && (fnName === 'mountComponent' || fnName === 'updateComponent' || // TODO: receiveComponent()?
      fnName === '_renderValidatedComponent')) {

        if (this._currentElement.type === ReactMount.TopLevelWrapper) {
          return func.apply(this, args);
        }

        var rootNodeID = fnName === 'mountComponent' ? args[0] : this._rootNodeID;
        var isRender = fnName === '_renderValidatedComponent';
        var isMount = fnName === 'mountComponent';

        var mountStack = ReactDefaultPerf._mountStack;
        var entry = ReactDefaultPerf._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1];

        if (isRender) {
          addValue(entry.counts, rootNodeID, 1);
        } else if (isMount) {
          entry.created[rootNodeID] = true;
          mountStack.push(0);
        }

        start = performanceNow();
        rv = func.apply(this, args);
        totalTime = performanceNow() - start;

        if (isRender) {
          addValue(entry.render, rootNodeID, totalTime);
        } else if (isMount) {
          var subMountTime = mountStack.pop();
          mountStack[mountStack.length - 1] += totalTime;
          addValue(entry.exclusive, rootNodeID, totalTime - subMountTime);
          addValue(entry.inclusive, rootNodeID, totalTime);
        } else {
          addValue(entry.inclusive, rootNodeID, totalTime);
        }

        entry.displayNames[rootNodeID] = {
          current: this.getName(),
          owner: this._currentElement._owner ? this._currentElement._owner.getName() : '<root>'
        };

        return rv;
      } else {
        return func.apply(this, args);
      }
    };
  }
};

module.exports = ReactDefaultPerf;
},{"./DOMProperty":65,"./ReactDefaultPerfAnalysis":107,"./ReactMount":121,"./ReactPerf":127,"fbjs/lib/performanceNow":208}],107:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultPerfAnalysis
 */

'use strict';

var assign = require('./Object.assign');

// Don't try to save users less than 1.2ms (a number I made up)
var DONT_CARE_THRESHOLD = 1.2;
var DOM_OPERATION_TYPES = {
  '_mountImageIntoNode': 'set innerHTML',
  INSERT_MARKUP: 'set innerHTML',
  MOVE_EXISTING: 'move',
  REMOVE_NODE: 'remove',
  SET_MARKUP: 'set innerHTML',
  TEXT_CONTENT: 'set textContent',
  'setValueForProperty': 'update attribute',
  'setValueForAttribute': 'update attribute',
  'deleteValueForProperty': 'remove attribute',
  'setValueForStyles': 'update styles',
  'replaceNodeWithMarkup': 'replace',
  'updateTextContent': 'set textContent'
};

function getTotalTime(measurements) {
  // TODO: return number of DOM ops? could be misleading.
  // TODO: measure dropped frames after reconcile?
  // TODO: log total time of each reconcile and the top-level component
  // class that triggered it.
  var totalTime = 0;
  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    totalTime += measurement.totalTime;
  }
  return totalTime;
}

function getDOMSummary(measurements) {
  var items = [];
  measurements.forEach(function (measurement) {
    Object.keys(measurement.writes).forEach(function (id) {
      measurement.writes[id].forEach(function (write) {
        items.push({
          id: id,
          type: DOM_OPERATION_TYPES[write.type] || write.type,
          args: write.args
        });
      });
    });
  });
  return items;
}

function getExclusiveSummary(measurements) {
  var candidates = {};
  var displayName;

  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    var allIDs = assign({}, measurement.exclusive, measurement.inclusive);

    for (var id in allIDs) {
      displayName = measurement.displayNames[id].current;

      candidates[displayName] = candidates[displayName] || {
        componentName: displayName,
        inclusive: 0,
        exclusive: 0,
        render: 0,
        count: 0
      };
      if (measurement.render[id]) {
        candidates[displayName].render += measurement.render[id];
      }
      if (measurement.exclusive[id]) {
        candidates[displayName].exclusive += measurement.exclusive[id];
      }
      if (measurement.inclusive[id]) {
        candidates[displayName].inclusive += measurement.inclusive[id];
      }
      if (measurement.counts[id]) {
        candidates[displayName].count += measurement.counts[id];
      }
    }
  }

  // Now make a sorted array with the results.
  var arr = [];
  for (displayName in candidates) {
    if (candidates[displayName].exclusive >= DONT_CARE_THRESHOLD) {
      arr.push(candidates[displayName]);
    }
  }

  arr.sort(function (a, b) {
    return b.exclusive - a.exclusive;
  });

  return arr;
}

function getInclusiveSummary(measurements, onlyClean) {
  var candidates = {};
  var inclusiveKey;

  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    var allIDs = assign({}, measurement.exclusive, measurement.inclusive);
    var cleanComponents;

    if (onlyClean) {
      cleanComponents = getUnchangedComponents(measurement);
    }

    for (var id in allIDs) {
      if (onlyClean && !cleanComponents[id]) {
        continue;
      }

      var displayName = measurement.displayNames[id];

      // Inclusive time is not useful for many components without knowing where
      // they are instantiated. So we aggregate inclusive time with both the
      // owner and current displayName as the key.
      inclusiveKey = displayName.owner + ' > ' + displayName.current;

      candidates[inclusiveKey] = candidates[inclusiveKey] || {
        componentName: inclusiveKey,
        time: 0,
        count: 0
      };

      if (measurement.inclusive[id]) {
        candidates[inclusiveKey].time += measurement.inclusive[id];
      }
      if (measurement.counts[id]) {
        candidates[inclusiveKey].count += measurement.counts[id];
      }
    }
  }

  // Now make a sorted array with the results.
  var arr = [];
  for (inclusiveKey in candidates) {
    if (candidates[inclusiveKey].time >= DONT_CARE_THRESHOLD) {
      arr.push(candidates[inclusiveKey]);
    }
  }

  arr.sort(function (a, b) {
    return b.time - a.time;
  });

  return arr;
}

function getUnchangedComponents(measurement) {
  // For a given reconcile, look at which components did not actually
  // render anything to the DOM and return a mapping of their ID to
  // the amount of time it took to render the entire subtree.
  var cleanComponents = {};
  var dirtyLeafIDs = Object.keys(measurement.writes);
  var allIDs = assign({}, measurement.exclusive, measurement.inclusive);

  for (var id in allIDs) {
    var isDirty = false;
    // For each component that rendered, see if a component that triggered
    // a DOM op is in its subtree.
    for (var i = 0; i < dirtyLeafIDs.length; i++) {
      if (dirtyLeafIDs[i].indexOf(id) === 0) {
        isDirty = true;
        break;
      }
    }
    // check if component newly created
    if (measurement.created[id]) {
      isDirty = true;
    }
    if (!isDirty && measurement.counts[id] > 0) {
      cleanComponents[id] = true;
    }
  }
  return cleanComponents;
}

var ReactDefaultPerfAnalysis = {
  getExclusiveSummary: getExclusiveSummary,
  getInclusiveSummary: getInclusiveSummary,
  getDOMSummary: getDOMSummary,
  getTotalTime: getTotalTime
};

module.exports = ReactDefaultPerfAnalysis;
},{"./Object.assign":78}],108:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactElement
 */

'use strict';

var ReactCurrentOwner = require('./ReactCurrentOwner');

var assign = require('./Object.assign');
var canDefineProperty = require('./canDefineProperty');

// The Symbol used to tag the ReactElement type. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
var REACT_ELEMENT_TYPE = typeof Symbol === 'function' && Symbol['for'] && Symbol['for']('react.element') || 0xeac7;

var RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true
};

/**
 * Base constructor for all React elements. This is only used to make this
 * work with a dynamic instanceof check. Nothing should live on this prototype.
 *
 * @param {*} type
 * @param {*} key
 * @param {string|object} ref
 * @param {*} self A *temporary* helper to detect places where `this` is
 * different from the `owner` when React.createElement is called, so that we
 * can warn. We want to get rid of owner and replace string `ref`s with arrow
 * functions, and as long as `this` and owner are the same, there will be no
 * change in behavior.
 * @param {*} source An annotation object (added by a transpiler or otherwise)
 * indicating filename, line number, and/or other information.
 * @param {*} owner
 * @param {*} props
 * @internal
 */
var ReactElement = function (type, key, ref, self, source, owner, props) {
  var element = {
    // This tag allow us to uniquely identify this as a React Element
    $$typeof: REACT_ELEMENT_TYPE,

    // Built-in properties that belong on the element
    type: type,
    key: key,
    ref: ref,
    props: props,

    // Record the component responsible for creating this element.
    _owner: owner
  };

  if ("production" !== 'production') {
    // The validation flag is currently mutative. We put it on
    // an external backing store so that we can freeze the whole object.
    // This can be replaced with a WeakMap once they are implemented in
    // commonly used development environments.
    element._store = {};

    // To make comparing ReactElements easier for testing purposes, we make
    // the validation flag non-enumerable (where possible, which should
    // include every environment we run tests in), so the test framework
    // ignores it.
    if (canDefineProperty) {
      Object.defineProperty(element._store, 'validated', {
        configurable: false,
        enumerable: false,
        writable: true,
        value: false
      });
      // self and source are DEV only properties.
      Object.defineProperty(element, '_self', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: self
      });
      // Two elements created in two different places should be considered
      // equal for testing purposes and therefore we hide it from enumeration.
      Object.defineProperty(element, '_source', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: source
      });
    } else {
      element._store.validated = false;
      element._self = self;
      element._source = source;
    }
    Object.freeze(element.props);
    Object.freeze(element);
  }

  return element;
};

ReactElement.createElement = function (type, config, children) {
  var propName;

  // Reserved names are extracted
  var props = {};

  var key = null;
  var ref = null;
  var self = null;
  var source = null;

  if (config != null) {
    ref = config.ref === undefined ? null : config.ref;
    key = config.key === undefined ? null : '' + config.key;
    self = config.__self === undefined ? null : config.__self;
    source = config.__source === undefined ? null : config.__source;
    // Remaining properties are added to a new props object
    for (propName in config) {
      if (config.hasOwnProperty(propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
        props[propName] = config[propName];
      }
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  // Resolve default props
  if (type && type.defaultProps) {
    var defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (typeof props[propName] === 'undefined') {
        props[propName] = defaultProps[propName];
      }
    }
  }

  return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
};

ReactElement.createFactory = function (type) {
  var factory = ReactElement.createElement.bind(null, type);
  // Expose the type on the factory and the prototype so that it can be
  // easily accessed on elements. E.g. `<Foo />.type === Foo`.
  // This should not be named `constructor` since this may not be the function
  // that created the element, and it may not even be a constructor.
  // Legacy hook TODO: Warn if this is accessed
  factory.type = type;
  return factory;
};

ReactElement.cloneAndReplaceKey = function (oldElement, newKey) {
  var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);

  return newElement;
};

ReactElement.cloneAndReplaceProps = function (oldElement, newProps) {
  var newElement = ReactElement(oldElement.type, oldElement.key, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, newProps);

  if ("production" !== 'production') {
    // If the key on the original is valid, then the clone is valid
    newElement._store.validated = oldElement._store.validated;
  }

  return newElement;
};

ReactElement.cloneElement = function (element, config, children) {
  var propName;

  // Original props are copied
  var props = assign({}, element.props);

  // Reserved names are extracted
  var key = element.key;
  var ref = element.ref;
  // Self is preserved since the owner is preserved.
  var self = element._self;
  // Source is preserved since cloneElement is unlikely to be targeted by a
  // transpiler, and the original source is probably a better indicator of the
  // true owner.
  var source = element._source;

  // Owner will be preserved, unless ref is overridden
  var owner = element._owner;

  if (config != null) {
    if (config.ref !== undefined) {
      // Silently steal the ref from the parent.
      ref = config.ref;
      owner = ReactCurrentOwner.current;
    }
    if (config.key !== undefined) {
      key = '' + config.key;
    }
    // Remaining properties override existing props
    for (propName in config) {
      if (config.hasOwnProperty(propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
        props[propName] = config[propName];
      }
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  return ReactElement(element.type, key, ref, self, source, owner, props);
};

/**
 * @param {?object} object
 * @return {boolean} True if `object` is a valid component.
 * @final
 */
ReactElement.isValidElement = function (object) {
  return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
};

module.exports = ReactElement;
},{"./Object.assign":78,"./ReactCurrentOwner":90,"./canDefineProperty":160}],109:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactElementValidator
 */

/**
 * ReactElementValidator provides a wrapper around a element factory
 * which validates the props passed to the element. This is intended to be
 * used only in DEV and could be replaced by a static type checker for languages
 * that support it.
 */

'use strict';

var ReactElement = require('./ReactElement');
var ReactPropTypeLocations = require('./ReactPropTypeLocations');
var ReactPropTypeLocationNames = require('./ReactPropTypeLocationNames');
var ReactCurrentOwner = require('./ReactCurrentOwner');

var canDefineProperty = require('./canDefineProperty');
var getIteratorFn = require('./getIteratorFn');
var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

function getDeclarationErrorAddendum() {
  if (ReactCurrentOwner.current) {
    var name = ReactCurrentOwner.current.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

/**
 * Warn if there's no key explicitly set on dynamic arrays of children or
 * object keys are not valid. This allows us to keep track of children between
 * updates.
 */
var ownerHasKeyUseWarning = {};

var loggedTypeFailures = {};

/**
 * Warn if the element doesn't have an explicit key assigned to it.
 * This element is in an array. The array could grow and shrink or be
 * reordered. All children that haven't already been validated are required to
 * have a "key" property assigned to it.
 *
 * @internal
 * @param {ReactElement} element Element that requires a key.
 * @param {*} parentType element's parent's type.
 */
function validateExplicitKey(element, parentType) {
  if (!element._store || element._store.validated || element.key != null) {
    return;
  }
  element._store.validated = true;

  var addenda = getAddendaForKeyUse('uniqueKey', element, parentType);
  if (addenda === null) {
    // we already showed the warning
    return;
  }
  "production" !== 'production' ? warning(false, 'Each child in an array or iterator should have a unique "key" prop.' + '%s%s%s', addenda.parentOrOwner || '', addenda.childOwner || '', addenda.url || '') : undefined;
}

/**
 * Shared warning and monitoring code for the key warnings.
 *
 * @internal
 * @param {string} messageType A key used for de-duping warnings.
 * @param {ReactElement} element Component that requires a key.
 * @param {*} parentType element's parent's type.
 * @returns {?object} A set of addenda to use in the warning message, or null
 * if the warning has already been shown before (and shouldn't be shown again).
 */
function getAddendaForKeyUse(messageType, element, parentType) {
  var addendum = getDeclarationErrorAddendum();
  if (!addendum) {
    var parentName = typeof parentType === 'string' ? parentType : parentType.displayName || parentType.name;
    if (parentName) {
      addendum = ' Check the top-level render call using <' + parentName + '>.';
    }
  }

  var memoizer = ownerHasKeyUseWarning[messageType] || (ownerHasKeyUseWarning[messageType] = {});
  if (memoizer[addendum]) {
    return null;
  }
  memoizer[addendum] = true;

  var addenda = {
    parentOrOwner: addendum,
    url: ' See https://fb.me/react-warning-keys for more information.',
    childOwner: null
  };

  // Usually the current owner is the offender, but if it accepts children as a
  // property, it may be the creator of the child that's responsible for
  // assigning it a key.
  if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
    // Give the component that originally created this child.
    addenda.childOwner = ' It was passed a child from ' + element._owner.getName() + '.';
  }

  return addenda;
}

/**
 * Ensure that every element either is passed in a static location, in an
 * array with an explicit keys property defined, or in an object literal
 * with valid key property.
 *
 * @internal
 * @param {ReactNode} node Statically passed child of any type.
 * @param {*} parentType node's parent's type.
 */
function validateChildKeys(node, parentType) {
  if (typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var child = node[i];
      if (ReactElement.isValidElement(child)) {
        validateExplicitKey(child, parentType);
      }
    }
  } else if (ReactElement.isValidElement(node)) {
    // This element was passed in a valid location.
    if (node._store) {
      node._store.validated = true;
    }
  } else if (node) {
    var iteratorFn = getIteratorFn(node);
    // Entry iterators provide implicit keys.
    if (iteratorFn) {
      if (iteratorFn !== node.entries) {
        var iterator = iteratorFn.call(node);
        var step;
        while (!(step = iterator.next()).done) {
          if (ReactElement.isValidElement(step.value)) {
            validateExplicitKey(step.value, parentType);
          }
        }
      }
    }
  }
}

/**
 * Assert that the props are valid
 *
 * @param {string} componentName Name of the component for error messages.
 * @param {object} propTypes Map of prop name to a ReactPropType
 * @param {object} props
 * @param {string} location e.g. "prop", "context", "child context"
 * @private
 */
function checkPropTypes(componentName, propTypes, props, location) {
  for (var propName in propTypes) {
    if (propTypes.hasOwnProperty(propName)) {
      var error;
      // Prop type validation may throw. In case they do, we don't want to
      // fail the render phase where it didn't fail before. So we log it.
      // After these have been cleaned up, we'll let them throw.
      try {
        // This is intentionally an invariant that gets caught. It's the same
        // behavior as without this statement except with a better message.
        !(typeof propTypes[propName] === 'function') ? "production" !== 'production' ? invariant(false, '%s: %s type `%s` is invalid; it must be a function, usually from ' + 'React.PropTypes.', componentName || 'React class', ReactPropTypeLocationNames[location], propName) : invariant(false) : undefined;
        error = propTypes[propName](props, propName, componentName, location);
      } catch (ex) {
        error = ex;
      }
      "production" !== 'production' ? warning(!error || error instanceof Error, '%s: type specification of %s `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', ReactPropTypeLocationNames[location], propName, typeof error) : undefined;
      if (error instanceof Error && !(error.message in loggedTypeFailures)) {
        // Only monitor this failure once because there tends to be a lot of the
        // same error.
        loggedTypeFailures[error.message] = true;

        var addendum = getDeclarationErrorAddendum();
        "production" !== 'production' ? warning(false, 'Failed propType: %s%s', error.message, addendum) : undefined;
      }
    }
  }
}

/**
 * Given an element, validate that its props follow the propTypes definition,
 * provided by the type.
 *
 * @param {ReactElement} element
 */
function validatePropTypes(element) {
  var componentClass = element.type;
  if (typeof componentClass !== 'function') {
    return;
  }
  var name = componentClass.displayName || componentClass.name;
  if (componentClass.propTypes) {
    checkPropTypes(name, componentClass.propTypes, element.props, ReactPropTypeLocations.prop);
  }
  if (typeof componentClass.getDefaultProps === 'function') {
    "production" !== 'production' ? warning(componentClass.getDefaultProps.isReactClassApproved, 'getDefaultProps is only used on classic React.createClass ' + 'definitions. Use a static property named `defaultProps` instead.') : undefined;
  }
}

var ReactElementValidator = {

  createElement: function (type, props, children) {
    var validType = typeof type === 'string' || typeof type === 'function';
    // We warn in this case but don't throw. We expect the element creation to
    // succeed and there will likely be errors in render.
    "production" !== 'production' ? warning(validType, 'React.createElement: type should not be null, undefined, boolean, or ' + 'number. It should be a string (for DOM elements) or a ReactClass ' + '(for composite components).%s', getDeclarationErrorAddendum()) : undefined;

    var element = ReactElement.createElement.apply(this, arguments);

    // The result can be nullish if a mock or a custom function is used.
    // TODO: Drop this when these are no longer allowed as the type argument.
    if (element == null) {
      return element;
    }

    // Skip key warning if the type isn't valid since our key validation logic
    // doesn't expect a non-string/function type and can throw confusing errors.
    // We don't want exception behavior to differ between dev and prod.
    // (Rendering will throw with a helpful message and as soon as the type is
    // fixed, the key warnings will appear.)
    if (validType) {
      for (var i = 2; i < arguments.length; i++) {
        validateChildKeys(arguments[i], type);
      }
    }

    validatePropTypes(element);

    return element;
  },

  createFactory: function (type) {
    var validatedFactory = ReactElementValidator.createElement.bind(null, type);
    // Legacy hook TODO: Warn if this is accessed
    validatedFactory.type = type;

    if ("production" !== 'production') {
      if (canDefineProperty) {
        Object.defineProperty(validatedFactory, 'type', {
          enumerable: false,
          get: function () {
            "production" !== 'production' ? warning(false, 'Factory.type is deprecated. Access the class directly ' + 'before passing it to createFactory.') : undefined;
            Object.defineProperty(this, 'type', {
              value: type
            });
            return type;
          }
        });
      }
    }

    return validatedFactory;
  },

  cloneElement: function (element, props, children) {
    var newElement = ReactElement.cloneElement.apply(this, arguments);
    for (var i = 2; i < arguments.length; i++) {
      validateChildKeys(arguments[i], newElement.type);
    }
    validatePropTypes(newElement);
    return newElement;
  }

};

module.exports = ReactElementValidator;
},{"./ReactCurrentOwner":90,"./ReactElement":108,"./ReactPropTypeLocationNames":128,"./ReactPropTypeLocations":129,"./canDefineProperty":160,"./getIteratorFn":171,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],110:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactEmptyComponent
 */

'use strict';

var ReactElement = require('./ReactElement');
var ReactEmptyComponentRegistry = require('./ReactEmptyComponentRegistry');
var ReactReconciler = require('./ReactReconciler');

var assign = require('./Object.assign');

var placeholderElement;

var ReactEmptyComponentInjection = {
  injectEmptyComponent: function (component) {
    placeholderElement = ReactElement.createElement(component);
  }
};

var ReactEmptyComponent = function (instantiate) {
  this._currentElement = null;
  this._rootNodeID = null;
  this._renderedComponent = instantiate(placeholderElement);
};
assign(ReactEmptyComponent.prototype, {
  construct: function (element) {},
  mountComponent: function (rootID, transaction, context) {
    ReactEmptyComponentRegistry.registerNullComponentID(rootID);
    this._rootNodeID = rootID;
    return ReactReconciler.mountComponent(this._renderedComponent, rootID, transaction, context);
  },
  receiveComponent: function () {},
  unmountComponent: function (rootID, transaction, context) {
    ReactReconciler.unmountComponent(this._renderedComponent);
    ReactEmptyComponentRegistry.deregisterNullComponentID(this._rootNodeID);
    this._rootNodeID = null;
    this._renderedComponent = null;
  }
});

ReactEmptyComponent.injection = ReactEmptyComponentInjection;

module.exports = ReactEmptyComponent;
},{"./Object.assign":78,"./ReactElement":108,"./ReactEmptyComponentRegistry":111,"./ReactReconciler":132}],111:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactEmptyComponentRegistry
 */

'use strict';

// This registry keeps track of the React IDs of the components that rendered to
// `null` (in reality a placeholder such as `noscript`)
var nullComponentIDsRegistry = {};

/**
 * @param {string} id Component's `_rootNodeID`.
 * @return {boolean} True if the component is rendered to null.
 */
function isNullComponentID(id) {
  return !!nullComponentIDsRegistry[id];
}

/**
 * Mark the component as having rendered to null.
 * @param {string} id Component's `_rootNodeID`.
 */
function registerNullComponentID(id) {
  nullComponentIDsRegistry[id] = true;
}

/**
 * Unmark the component as having rendered to null: it renders to something now.
 * @param {string} id Component's `_rootNodeID`.
 */
function deregisterNullComponentID(id) {
  delete nullComponentIDsRegistry[id];
}

var ReactEmptyComponentRegistry = {
  isNullComponentID: isNullComponentID,
  registerNullComponentID: registerNullComponentID,
  deregisterNullComponentID: deregisterNullComponentID
};

module.exports = ReactEmptyComponentRegistry;
},{}],112:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactErrorUtils
 * @typechecks
 */

'use strict';

var caughtError = null;

/**
 * Call a function while guarding against errors that happens within it.
 *
 * @param {?String} name of the guard to use for logging or debugging
 * @param {Function} func The function to invoke
 * @param {*} a First argument
 * @param {*} b Second argument
 */
function invokeGuardedCallback(name, func, a, b) {
  try {
    return func(a, b);
  } catch (x) {
    if (caughtError === null) {
      caughtError = x;
    }
    return undefined;
  }
}

var ReactErrorUtils = {
  invokeGuardedCallback: invokeGuardedCallback,

  /**
   * Invoked by ReactTestUtils.Simulate so that any errors thrown by the event
   * handler are sure to be rethrown by rethrowCaughtError.
   */
  invokeGuardedCallbackWithCatch: invokeGuardedCallback,

  /**
   * During execution of guarded functions we will capture the first error which
   * we will rethrow to be handled by the top level error handler.
   */
  rethrowCaughtError: function () {
    if (caughtError) {
      var error = caughtError;
      caughtError = null;
      throw error;
    }
  }
};

if ("production" !== 'production') {
  /**
   * To help development we can get better devtools integration by simulating a
   * real browser event.
   */
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof document !== 'undefined' && typeof document.createEvent === 'function') {
    var fakeNode = document.createElement('react');
    ReactErrorUtils.invokeGuardedCallback = function (name, func, a, b) {
      var boundFunc = func.bind(null, a, b);
      var evtType = 'react-' + name;
      fakeNode.addEventListener(evtType, boundFunc, false);
      var evt = document.createEvent('Event');
      evt.initEvent(evtType, false, false);
      fakeNode.dispatchEvent(evt);
      fakeNode.removeEventListener(evtType, boundFunc, false);
    };
  }
}

module.exports = ReactErrorUtils;
},{}],113:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactEventEmitterMixin
 */

'use strict';

var EventPluginHub = require('./EventPluginHub');

function runEventQueueInBatch(events) {
  EventPluginHub.enqueueEvents(events);
  EventPluginHub.processEventQueue(false);
}

var ReactEventEmitterMixin = {

  /**
   * Streams a fired top-level event to `EventPluginHub` where plugins have the
   * opportunity to create `ReactEvent`s to be dispatched.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {object} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native environment event.
   */
  handleTopLevel: function (topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
    var events = EventPluginHub.extractEvents(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget);
    runEventQueueInBatch(events);
  }
};

module.exports = ReactEventEmitterMixin;
},{"./EventPluginHub":71}],114:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactEventListener
 * @typechecks static-only
 */

'use strict';

var EventListener = require('fbjs/lib/EventListener');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');
var PooledClass = require('./PooledClass');
var ReactInstanceHandles = require('./ReactInstanceHandles');
var ReactMount = require('./ReactMount');
var ReactUpdates = require('./ReactUpdates');

var assign = require('./Object.assign');
var getEventTarget = require('./getEventTarget');
var getUnboundedScrollPosition = require('fbjs/lib/getUnboundedScrollPosition');

var DOCUMENT_FRAGMENT_NODE_TYPE = 11;

/**
 * Finds the parent React component of `node`.
 *
 * @param {*} node
 * @return {?DOMEventTarget} Parent container, or `null` if the specified node
 *                           is not nested.
 */
function findParent(node) {
  // TODO: It may be a good idea to cache this to prevent unnecessary DOM
  // traversal, but caching is difficult to do correctly without using a
  // mutation observer to listen for all DOM changes.
  var nodeID = ReactMount.getID(node);
  var rootID = ReactInstanceHandles.getReactRootIDFromNodeID(nodeID);
  var container = ReactMount.findReactContainerForID(rootID);
  var parent = ReactMount.getFirstReactDOM(container);
  return parent;
}

// Used to store ancestor hierarchy in top level callback
function TopLevelCallbackBookKeeping(topLevelType, nativeEvent) {
  this.topLevelType = topLevelType;
  this.nativeEvent = nativeEvent;
  this.ancestors = [];
}
assign(TopLevelCallbackBookKeeping.prototype, {
  destructor: function () {
    this.topLevelType = null;
    this.nativeEvent = null;
    this.ancestors.length = 0;
  }
});
PooledClass.addPoolingTo(TopLevelCallbackBookKeeping, PooledClass.twoArgumentPooler);

function handleTopLevelImpl(bookKeeping) {
  // TODO: Re-enable event.path handling
  //
  // if (bookKeeping.nativeEvent.path && bookKeeping.nativeEvent.path.length > 1) {
  //   // New browsers have a path attribute on native events
  //   handleTopLevelWithPath(bookKeeping);
  // } else {
  //   // Legacy browsers don't have a path attribute on native events
  //   handleTopLevelWithoutPath(bookKeeping);
  // }

  void handleTopLevelWithPath; // temporarily unused
  handleTopLevelWithoutPath(bookKeeping);
}

// Legacy browsers don't have a path attribute on native events
function handleTopLevelWithoutPath(bookKeeping) {
  var topLevelTarget = ReactMount.getFirstReactDOM(getEventTarget(bookKeeping.nativeEvent)) || window;

  // Loop through the hierarchy, in case there's any nested components.
  // It's important that we build the array of ancestors before calling any
  // event handlers, because event handlers can modify the DOM, leading to
  // inconsistencies with ReactMount's node cache. See #1105.
  var ancestor = topLevelTarget;
  while (ancestor) {
    bookKeeping.ancestors.push(ancestor);
    ancestor = findParent(ancestor);
  }

  for (var i = 0; i < bookKeeping.ancestors.length; i++) {
    topLevelTarget = bookKeeping.ancestors[i];
    var topLevelTargetID = ReactMount.getID(topLevelTarget) || '';
    ReactEventListener._handleTopLevel(bookKeeping.topLevelType, topLevelTarget, topLevelTargetID, bookKeeping.nativeEvent, getEventTarget(bookKeeping.nativeEvent));
  }
}

// New browsers have a path attribute on native events
function handleTopLevelWithPath(bookKeeping) {
  var path = bookKeeping.nativeEvent.path;
  var currentNativeTarget = path[0];
  var eventsFired = 0;
  for (var i = 0; i < path.length; i++) {
    var currentPathElement = path[i];
    if (currentPathElement.nodeType === DOCUMENT_FRAGMENT_NODE_TYPE) {
      currentNativeTarget = path[i + 1];
    }
    // TODO: slow
    var reactParent = ReactMount.getFirstReactDOM(currentPathElement);
    if (reactParent === currentPathElement) {
      var currentPathElementID = ReactMount.getID(currentPathElement);
      var newRootID = ReactInstanceHandles.getReactRootIDFromNodeID(currentPathElementID);
      bookKeeping.ancestors.push(currentPathElement);

      var topLevelTargetID = ReactMount.getID(currentPathElement) || '';
      eventsFired++;
      ReactEventListener._handleTopLevel(bookKeeping.topLevelType, currentPathElement, topLevelTargetID, bookKeeping.nativeEvent, currentNativeTarget);

      // Jump to the root of this React render tree
      while (currentPathElementID !== newRootID) {
        i++;
        currentPathElement = path[i];
        currentPathElementID = ReactMount.getID(currentPathElement);
      }
    }
  }
  if (eventsFired === 0) {
    ReactEventListener._handleTopLevel(bookKeeping.topLevelType, window, '', bookKeeping.nativeEvent, getEventTarget(bookKeeping.nativeEvent));
  }
}

function scrollValueMonitor(cb) {
  var scrollPosition = getUnboundedScrollPosition(window);
  cb(scrollPosition);
}

var ReactEventListener = {
  _enabled: true,
  _handleTopLevel: null,

  WINDOW_HANDLE: ExecutionEnvironment.canUseDOM ? window : null,

  setHandleTopLevel: function (handleTopLevel) {
    ReactEventListener._handleTopLevel = handleTopLevel;
  },

  setEnabled: function (enabled) {
    ReactEventListener._enabled = !!enabled;
  },

  isEnabled: function () {
    return ReactEventListener._enabled;
  },

  /**
   * Traps top-level events by using event bubbling.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {string} handlerBaseName Event name (e.g. "click").
   * @param {object} handle Element on which to attach listener.
   * @return {?object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
  trapBubbledEvent: function (topLevelType, handlerBaseName, handle) {
    var element = handle;
    if (!element) {
      return null;
    }
    return EventListener.listen(element, handlerBaseName, ReactEventListener.dispatchEvent.bind(null, topLevelType));
  },

  /**
   * Traps a top-level event by using event capturing.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {string} handlerBaseName Event name (e.g. "click").
   * @param {object} handle Element on which to attach listener.
   * @return {?object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
  trapCapturedEvent: function (topLevelType, handlerBaseName, handle) {
    var element = handle;
    if (!element) {
      return null;
    }
    return EventListener.capture(element, handlerBaseName, ReactEventListener.dispatchEvent.bind(null, topLevelType));
  },

  monitorScrollValue: function (refresh) {
    var callback = scrollValueMonitor.bind(null, refresh);
    EventListener.listen(window, 'scroll', callback);
  },

  dispatchEvent: function (topLevelType, nativeEvent) {
    if (!ReactEventListener._enabled) {
      return;
    }

    var bookKeeping = TopLevelCallbackBookKeeping.getPooled(topLevelType, nativeEvent);
    try {
      // Event queue being processed in the same cycle allows
      // `preventDefault`.
      ReactUpdates.batchedUpdates(handleTopLevelImpl, bookKeeping);
    } finally {
      TopLevelCallbackBookKeeping.release(bookKeeping);
    }
  }
};

module.exports = ReactEventListener;
},{"./Object.assign":78,"./PooledClass":79,"./ReactInstanceHandles":117,"./ReactMount":121,"./ReactUpdates":139,"./getEventTarget":170,"fbjs/lib/EventListener":185,"fbjs/lib/ExecutionEnvironment":186,"fbjs/lib/getUnboundedScrollPosition":197}],115:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactInjection
 */

'use strict';

var DOMProperty = require('./DOMProperty');
var EventPluginHub = require('./EventPluginHub');
var ReactComponentEnvironment = require('./ReactComponentEnvironment');
var ReactClass = require('./ReactClass');
var ReactEmptyComponent = require('./ReactEmptyComponent');
var ReactBrowserEventEmitter = require('./ReactBrowserEventEmitter');
var ReactNativeComponent = require('./ReactNativeComponent');
var ReactPerf = require('./ReactPerf');
var ReactRootIndex = require('./ReactRootIndex');
var ReactUpdates = require('./ReactUpdates');

var ReactInjection = {
  Component: ReactComponentEnvironment.injection,
  Class: ReactClass.injection,
  DOMProperty: DOMProperty.injection,
  EmptyComponent: ReactEmptyComponent.injection,
  EventPluginHub: EventPluginHub.injection,
  EventEmitter: ReactBrowserEventEmitter.injection,
  NativeComponent: ReactNativeComponent.injection,
  Perf: ReactPerf.injection,
  RootIndex: ReactRootIndex.injection,
  Updates: ReactUpdates.injection
};

module.exports = ReactInjection;
},{"./DOMProperty":65,"./EventPluginHub":71,"./ReactBrowserEventEmitter":82,"./ReactClass":85,"./ReactComponentEnvironment":88,"./ReactEmptyComponent":110,"./ReactNativeComponent":124,"./ReactPerf":127,"./ReactRootIndex":134,"./ReactUpdates":139}],116:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactInputSelection
 */

'use strict';

var ReactDOMSelection = require('./ReactDOMSelection');

var containsNode = require('fbjs/lib/containsNode');
var focusNode = require('fbjs/lib/focusNode');
var getActiveElement = require('fbjs/lib/getActiveElement');

function isInDocument(node) {
  return containsNode(document.documentElement, node);
}

/**
 * @ReactInputSelection: React input selection module. Based on Selection.js,
 * but modified to be suitable for react and has a couple of bug fixes (doesn't
 * assume buttons have range selections allowed).
 * Input selection module for React.
 */
var ReactInputSelection = {

  hasSelectionCapabilities: function (elem) {
    var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
    return nodeName && (nodeName === 'input' && elem.type === 'text' || nodeName === 'textarea' || elem.contentEditable === 'true');
  },

  getSelectionInformation: function () {
    var focusedElem = getActiveElement();
    return {
      focusedElem: focusedElem,
      selectionRange: ReactInputSelection.hasSelectionCapabilities(focusedElem) ? ReactInputSelection.getSelection(focusedElem) : null
    };
  },

  /**
   * @restoreSelection: If any selection information was potentially lost,
   * restore it. This is useful when performing operations that could remove dom
   * nodes and place them back in, resulting in focus being lost.
   */
  restoreSelection: function (priorSelectionInformation) {
    var curFocusedElem = getActiveElement();
    var priorFocusedElem = priorSelectionInformation.focusedElem;
    var priorSelectionRange = priorSelectionInformation.selectionRange;
    if (curFocusedElem !== priorFocusedElem && isInDocument(priorFocusedElem)) {
      if (ReactInputSelection.hasSelectionCapabilities(priorFocusedElem)) {
        ReactInputSelection.setSelection(priorFocusedElem, priorSelectionRange);
      }
      focusNode(priorFocusedElem);
    }
  },

  /**
   * @getSelection: Gets the selection bounds of a focused textarea, input or
   * contentEditable node.
   * -@input: Look up selection bounds of this input
   * -@return {start: selectionStart, end: selectionEnd}
   */
  getSelection: function (input) {
    var selection;

    if ('selectionStart' in input) {
      // Modern browser with input or textarea.
      selection = {
        start: input.selectionStart,
        end: input.selectionEnd
      };
    } else if (document.selection && (input.nodeName && input.nodeName.toLowerCase() === 'input')) {
      // IE8 input.
      var range = document.selection.createRange();
      // There can only be one selection per document in IE, so it must
      // be in our element.
      if (range.parentElement() === input) {
        selection = {
          start: -range.moveStart('character', -input.value.length),
          end: -range.moveEnd('character', -input.value.length)
        };
      }
    } else {
      // Content editable or old IE textarea.
      selection = ReactDOMSelection.getOffsets(input);
    }

    return selection || { start: 0, end: 0 };
  },

  /**
   * @setSelection: Sets the selection bounds of a textarea or input and focuses
   * the input.
   * -@input     Set selection bounds of this input or textarea
   * -@offsets   Object of same form that is returned from get*
   */
  setSelection: function (input, offsets) {
    var start = offsets.start;
    var end = offsets.end;
    if (typeof end === 'undefined') {
      end = start;
    }

    if ('selectionStart' in input) {
      input.selectionStart = start;
      input.selectionEnd = Math.min(end, input.value.length);
    } else if (document.selection && (input.nodeName && input.nodeName.toLowerCase() === 'input')) {
      var range = input.createTextRange();
      range.collapse(true);
      range.moveStart('character', start);
      range.moveEnd('character', end - start);
      range.select();
    } else {
      ReactDOMSelection.setOffsets(input, offsets);
    }
  }
};

module.exports = ReactInputSelection;
},{"./ReactDOMSelection":100,"fbjs/lib/containsNode":189,"fbjs/lib/focusNode":194,"fbjs/lib/getActiveElement":195}],117:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactInstanceHandles
 * @typechecks static-only
 */

'use strict';

var ReactRootIndex = require('./ReactRootIndex');

var invariant = require('fbjs/lib/invariant');

var SEPARATOR = '.';
var SEPARATOR_LENGTH = SEPARATOR.length;

/**
 * Maximum depth of traversals before we consider the possibility of a bad ID.
 */
var MAX_TREE_DEPTH = 10000;

/**
 * Creates a DOM ID prefix to use when mounting React components.
 *
 * @param {number} index A unique integer
 * @return {string} React root ID.
 * @internal
 */
function getReactRootIDString(index) {
  return SEPARATOR + index.toString(36);
}

/**
 * Checks if a character in the supplied ID is a separator or the end.
 *
 * @param {string} id A React DOM ID.
 * @param {number} index Index of the character to check.
 * @return {boolean} True if the character is a separator or end of the ID.
 * @private
 */
function isBoundary(id, index) {
  return id.charAt(index) === SEPARATOR || index === id.length;
}

/**
 * Checks if the supplied string is a valid React DOM ID.
 *
 * @param {string} id A React DOM ID, maybe.
 * @return {boolean} True if the string is a valid React DOM ID.
 * @private
 */
function isValidID(id) {
  return id === '' || id.charAt(0) === SEPARATOR && id.charAt(id.length - 1) !== SEPARATOR;
}

/**
 * Checks if the first ID is an ancestor of or equal to the second ID.
 *
 * @param {string} ancestorID
 * @param {string} descendantID
 * @return {boolean} True if `ancestorID` is an ancestor of `descendantID`.
 * @internal
 */
function isAncestorIDOf(ancestorID, descendantID) {
  return descendantID.indexOf(ancestorID) === 0 && isBoundary(descendantID, ancestorID.length);
}

/**
 * Gets the parent ID of the supplied React DOM ID, `id`.
 *
 * @param {string} id ID of a component.
 * @return {string} ID of the parent, or an empty string.
 * @private
 */
function getParentID(id) {
  return id ? id.substr(0, id.lastIndexOf(SEPARATOR)) : '';
}

/**
 * Gets the next DOM ID on the tree path from the supplied `ancestorID` to the
 * supplied `destinationID`. If they are equal, the ID is returned.
 *
 * @param {string} ancestorID ID of an ancestor node of `destinationID`.
 * @param {string} destinationID ID of the destination node.
 * @return {string} Next ID on the path from `ancestorID` to `destinationID`.
 * @private
 */
function getNextDescendantID(ancestorID, destinationID) {
  !(isValidID(ancestorID) && isValidID(destinationID)) ? "production" !== 'production' ? invariant(false, 'getNextDescendantID(%s, %s): Received an invalid React DOM ID.', ancestorID, destinationID) : invariant(false) : undefined;
  !isAncestorIDOf(ancestorID, destinationID) ? "production" !== 'production' ? invariant(false, 'getNextDescendantID(...): React has made an invalid assumption about ' + 'the DOM hierarchy. Expected `%s` to be an ancestor of `%s`.', ancestorID, destinationID) : invariant(false) : undefined;
  if (ancestorID === destinationID) {
    return ancestorID;
  }
  // Skip over the ancestor and the immediate separator. Traverse until we hit
  // another separator or we reach the end of `destinationID`.
  var start = ancestorID.length + SEPARATOR_LENGTH;
  var i;
  for (i = start; i < destinationID.length; i++) {
    if (isBoundary(destinationID, i)) {
      break;
    }
  }
  return destinationID.substr(0, i);
}

/**
 * Gets the nearest common ancestor ID of two IDs.
 *
 * Using this ID scheme, the nearest common ancestor ID is the longest common
 * prefix of the two IDs that immediately preceded a "marker" in both strings.
 *
 * @param {string} oneID
 * @param {string} twoID
 * @return {string} Nearest common ancestor ID, or the empty string if none.
 * @private
 */
function getFirstCommonAncestorID(oneID, twoID) {
  var minLength = Math.min(oneID.length, twoID.length);
  if (minLength === 0) {
    return '';
  }
  var lastCommonMarkerIndex = 0;
  // Use `<=` to traverse until the "EOL" of the shorter string.
  for (var i = 0; i <= minLength; i++) {
    if (isBoundary(oneID, i) && isBoundary(twoID, i)) {
      lastCommonMarkerIndex = i;
    } else if (oneID.charAt(i) !== twoID.charAt(i)) {
      break;
    }
  }
  var longestCommonID = oneID.substr(0, lastCommonMarkerIndex);
  !isValidID(longestCommonID) ? "production" !== 'production' ? invariant(false, 'getFirstCommonAncestorID(%s, %s): Expected a valid React DOM ID: %s', oneID, twoID, longestCommonID) : invariant(false) : undefined;
  return longestCommonID;
}

/**
 * Traverses the parent path between two IDs (either up or down). The IDs must
 * not be the same, and there must exist a parent path between them. If the
 * callback returns `false`, traversal is stopped.
 *
 * @param {?string} start ID at which to start traversal.
 * @param {?string} stop ID at which to end traversal.
 * @param {function} cb Callback to invoke each ID with.
 * @param {*} arg Argument to invoke the callback with.
 * @param {?boolean} skipFirst Whether or not to skip the first node.
 * @param {?boolean} skipLast Whether or not to skip the last node.
 * @private
 */
function traverseParentPath(start, stop, cb, arg, skipFirst, skipLast) {
  start = start || '';
  stop = stop || '';
  !(start !== stop) ? "production" !== 'production' ? invariant(false, 'traverseParentPath(...): Cannot traverse from and to the same ID, `%s`.', start) : invariant(false) : undefined;
  var traverseUp = isAncestorIDOf(stop, start);
  !(traverseUp || isAncestorIDOf(start, stop)) ? "production" !== 'production' ? invariant(false, 'traverseParentPath(%s, %s, ...): Cannot traverse from two IDs that do ' + 'not have a parent path.', start, stop) : invariant(false) : undefined;
  // Traverse from `start` to `stop` one depth at a time.
  var depth = 0;
  var traverse = traverseUp ? getParentID : getNextDescendantID;
  for (var id = start;; /* until break */id = traverse(id, stop)) {
    var ret;
    if ((!skipFirst || id !== start) && (!skipLast || id !== stop)) {
      ret = cb(id, traverseUp, arg);
    }
    if (ret === false || id === stop) {
      // Only break //after// visiting `stop`.
      break;
    }
    !(depth++ < MAX_TREE_DEPTH) ? "production" !== 'production' ? invariant(false, 'traverseParentPath(%s, %s, ...): Detected an infinite loop while ' + 'traversing the React DOM ID tree. This may be due to malformed IDs: %s', start, stop, id) : invariant(false) : undefined;
  }
}

/**
 * Manages the IDs assigned to DOM representations of React components. This
 * uses a specific scheme in order to traverse the DOM efficiently (e.g. in
 * order to simulate events).
 *
 * @internal
 */
var ReactInstanceHandles = {

  /**
   * Constructs a React root ID
   * @return {string} A React root ID.
   */
  createReactRootID: function () {
    return getReactRootIDString(ReactRootIndex.createReactRootIndex());
  },

  /**
   * Constructs a React ID by joining a root ID with a name.
   *
   * @param {string} rootID Root ID of a parent component.
   * @param {string} name A component's name (as flattened children).
   * @return {string} A React ID.
   * @internal
   */
  createReactID: function (rootID, name) {
    return rootID + name;
  },

  /**
   * Gets the DOM ID of the React component that is the root of the tree that
   * contains the React component with the supplied DOM ID.
   *
   * @param {string} id DOM ID of a React component.
   * @return {?string} DOM ID of the React component that is the root.
   * @internal
   */
  getReactRootIDFromNodeID: function (id) {
    if (id && id.charAt(0) === SEPARATOR && id.length > 1) {
      var index = id.indexOf(SEPARATOR, 1);
      return index > -1 ? id.substr(0, index) : id;
    }
    return null;
  },

  /**
   * Traverses the ID hierarchy and invokes the supplied `cb` on any IDs that
   * should would receive a `mouseEnter` or `mouseLeave` event.
   *
   * NOTE: Does not invoke the callback on the nearest common ancestor because
   * nothing "entered" or "left" that element.
   *
   * @param {string} leaveID ID being left.
   * @param {string} enterID ID being entered.
   * @param {function} cb Callback to invoke on each entered/left ID.
   * @param {*} upArg Argument to invoke the callback with on left IDs.
   * @param {*} downArg Argument to invoke the callback with on entered IDs.
   * @internal
   */
  traverseEnterLeave: function (leaveID, enterID, cb, upArg, downArg) {
    var ancestorID = getFirstCommonAncestorID(leaveID, enterID);
    if (ancestorID !== leaveID) {
      traverseParentPath(leaveID, ancestorID, cb, upArg, false, true);
    }
    if (ancestorID !== enterID) {
      traverseParentPath(ancestorID, enterID, cb, downArg, true, false);
    }
  },

  /**
   * Simulates the traversal of a two-phase, capture/bubble event dispatch.
   *
   * NOTE: This traversal happens on IDs without touching the DOM.
   *
   * @param {string} targetID ID of the target node.
   * @param {function} cb Callback to invoke.
   * @param {*} arg Argument to invoke the callback with.
   * @internal
   */
  traverseTwoPhase: function (targetID, cb, arg) {
    if (targetID) {
      traverseParentPath('', targetID, cb, arg, true, false);
      traverseParentPath(targetID, '', cb, arg, false, true);
    }
  },

  /**
   * Same as `traverseTwoPhase` but skips the `targetID`.
   */
  traverseTwoPhaseSkipTarget: function (targetID, cb, arg) {
    if (targetID) {
      traverseParentPath('', targetID, cb, arg, true, true);
      traverseParentPath(targetID, '', cb, arg, true, true);
    }
  },

  /**
   * Traverse a node ID, calling the supplied `cb` for each ancestor ID. For
   * example, passing `.0.$row-0.1` would result in `cb` getting called
   * with `.0`, `.0.$row-0`, and `.0.$row-0.1`.
   *
   * NOTE: This traversal happens on IDs without touching the DOM.
   *
   * @param {string} targetID ID of the target node.
   * @param {function} cb Callback to invoke.
   * @param {*} arg Argument to invoke the callback with.
   * @internal
   */
  traverseAncestors: function (targetID, cb, arg) {
    traverseParentPath('', targetID, cb, arg, true, false);
  },

  getFirstCommonAncestorID: getFirstCommonAncestorID,

  /**
   * Exposed for unit testing.
   * @private
   */
  _getNextDescendantID: getNextDescendantID,

  isAncestorIDOf: isAncestorIDOf,

  SEPARATOR: SEPARATOR

};

module.exports = ReactInstanceHandles;
},{"./ReactRootIndex":134,"fbjs/lib/invariant":200}],118:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactInstanceMap
 */

'use strict';

/**
 * `ReactInstanceMap` maintains a mapping from a public facing stateful
 * instance (key) and the internal representation (value). This allows public
 * methods to accept the user facing instance as an argument and map them back
 * to internal methods.
 */

// TODO: Replace this with ES6: var ReactInstanceMap = new Map();
var ReactInstanceMap = {

  /**
   * This API should be called `delete` but we'd have to make sure to always
   * transform these to strings for IE support. When this transform is fully
   * supported we can rename it.
   */
  remove: function (key) {
    key._reactInternalInstance = undefined;
  },

  get: function (key) {
    return key._reactInternalInstance;
  },

  has: function (key) {
    return key._reactInternalInstance !== undefined;
  },

  set: function (key, value) {
    key._reactInternalInstance = value;
  }

};

module.exports = ReactInstanceMap;
},{}],119:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactIsomorphic
 */

'use strict';

var ReactChildren = require('./ReactChildren');
var ReactComponent = require('./ReactComponent');
var ReactClass = require('./ReactClass');
var ReactDOMFactories = require('./ReactDOMFactories');
var ReactElement = require('./ReactElement');
var ReactElementValidator = require('./ReactElementValidator');
var ReactPropTypes = require('./ReactPropTypes');
var ReactVersion = require('./ReactVersion');

var assign = require('./Object.assign');
var onlyChild = require('./onlyChild');

var createElement = ReactElement.createElement;
var createFactory = ReactElement.createFactory;
var cloneElement = ReactElement.cloneElement;

if ("production" !== 'production') {
  createElement = ReactElementValidator.createElement;
  createFactory = ReactElementValidator.createFactory;
  cloneElement = ReactElementValidator.cloneElement;
}

var React = {

  // Modern

  Children: {
    map: ReactChildren.map,
    forEach: ReactChildren.forEach,
    count: ReactChildren.count,
    toArray: ReactChildren.toArray,
    only: onlyChild
  },

  Component: ReactComponent,

  createElement: createElement,
  cloneElement: cloneElement,
  isValidElement: ReactElement.isValidElement,

  // Classic

  PropTypes: ReactPropTypes,
  createClass: ReactClass.createClass,
  createFactory: createFactory,
  createMixin: function (mixin) {
    // Currently a noop. Will be used to validate and trace mixins.
    return mixin;
  },

  // This looks DOM specific but these are actually isomorphic helpers
  // since they are just generating DOM strings.
  DOM: ReactDOMFactories,

  version: ReactVersion,

  // Hook for JSX spread, don't use this for anything else.
  __spread: assign
};

module.exports = React;
},{"./Object.assign":78,"./ReactChildren":84,"./ReactClass":85,"./ReactComponent":86,"./ReactDOMFactories":94,"./ReactElement":108,"./ReactElementValidator":109,"./ReactPropTypes":130,"./ReactVersion":140,"./onlyChild":177}],120:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMarkupChecksum
 */

'use strict';

var adler32 = require('./adler32');

var TAG_END = /\/?>/;

var ReactMarkupChecksum = {
  CHECKSUM_ATTR_NAME: 'data-react-checksum',

  /**
   * @param {string} markup Markup string
   * @return {string} Markup string with checksum attribute attached
   */
  addChecksumToMarkup: function (markup) {
    var checksum = adler32(markup);

    // Add checksum (handle both parent tags and self-closing tags)
    return markup.replace(TAG_END, ' ' + ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="' + checksum + '"$&');
  },

  /**
   * @param {string} markup to use
   * @param {DOMElement} element root React element
   * @returns {boolean} whether or not the markup is the same
   */
  canReuseMarkup: function (markup, element) {
    var existingChecksum = element.getAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME);
    existingChecksum = existingChecksum && parseInt(existingChecksum, 10);
    var markupChecksum = adler32(markup);
    return markupChecksum === existingChecksum;
  }
};

module.exports = ReactMarkupChecksum;
},{"./adler32":159}],121:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMount
 */

'use strict';

var DOMProperty = require('./DOMProperty');
var ReactBrowserEventEmitter = require('./ReactBrowserEventEmitter');
var ReactCurrentOwner = require('./ReactCurrentOwner');
var ReactDOMFeatureFlags = require('./ReactDOMFeatureFlags');
var ReactElement = require('./ReactElement');
var ReactEmptyComponentRegistry = require('./ReactEmptyComponentRegistry');
var ReactInstanceHandles = require('./ReactInstanceHandles');
var ReactInstanceMap = require('./ReactInstanceMap');
var ReactMarkupChecksum = require('./ReactMarkupChecksum');
var ReactPerf = require('./ReactPerf');
var ReactReconciler = require('./ReactReconciler');
var ReactUpdateQueue = require('./ReactUpdateQueue');
var ReactUpdates = require('./ReactUpdates');

var assign = require('./Object.assign');
var emptyObject = require('fbjs/lib/emptyObject');
var containsNode = require('fbjs/lib/containsNode');
var instantiateReactComponent = require('./instantiateReactComponent');
var invariant = require('fbjs/lib/invariant');
var setInnerHTML = require('./setInnerHTML');
var shouldUpdateReactComponent = require('./shouldUpdateReactComponent');
var validateDOMNesting = require('./validateDOMNesting');
var warning = require('fbjs/lib/warning');

var ATTR_NAME = DOMProperty.ID_ATTRIBUTE_NAME;
var nodeCache = {};

var ELEMENT_NODE_TYPE = 1;
var DOC_NODE_TYPE = 9;
var DOCUMENT_FRAGMENT_NODE_TYPE = 11;

var ownerDocumentContextKey = '__ReactMount_ownerDocument$' + Math.random().toString(36).slice(2);

/** Mapping from reactRootID to React component instance. */
var instancesByReactRootID = {};

/** Mapping from reactRootID to `container` nodes. */
var containersByReactRootID = {};

if ("production" !== 'production') {
  /** __DEV__-only mapping from reactRootID to root elements. */
  var rootElementsByReactRootID = {};
}

// Used to store breadth-first search state in findComponentRoot.
var findComponentRootReusableArray = [];

/**
 * Finds the index of the first character
 * that's not common between the two given strings.
 *
 * @return {number} the index of the character where the strings diverge
 */
function firstDifferenceIndex(string1, string2) {
  var minLen = Math.min(string1.length, string2.length);
  for (var i = 0; i < minLen; i++) {
    if (string1.charAt(i) !== string2.charAt(i)) {
      return i;
    }
  }
  return string1.length === string2.length ? -1 : minLen;
}

/**
 * @param {DOMElement|DOMDocument} container DOM element that may contain
 * a React component
 * @return {?*} DOM element that may have the reactRoot ID, or null.
 */
function getReactRootElementInContainer(container) {
  if (!container) {
    return null;
  }

  if (container.nodeType === DOC_NODE_TYPE) {
    return container.documentElement;
  } else {
    return container.firstChild;
  }
}

/**
 * @param {DOMElement} container DOM element that may contain a React component.
 * @return {?string} A "reactRoot" ID, if a React component is rendered.
 */
function getReactRootID(container) {
  var rootElement = getReactRootElementInContainer(container);
  return rootElement && ReactMount.getID(rootElement);
}

/**
 * Accessing node[ATTR_NAME] or calling getAttribute(ATTR_NAME) on a form
 * element can return its control whose name or ID equals ATTR_NAME. All
 * DOM nodes support `getAttributeNode` but this can also get called on
 * other objects so just return '' if we're given something other than a
 * DOM node (such as window).
 *
 * @param {?DOMElement|DOMWindow|DOMDocument|DOMTextNode} node DOM node.
 * @return {string} ID of the supplied `domNode`.
 */
function getID(node) {
  var id = internalGetID(node);
  if (id) {
    if (nodeCache.hasOwnProperty(id)) {
      var cached = nodeCache[id];
      if (cached !== node) {
        !!isValid(cached, id) ? "production" !== 'production' ? invariant(false, 'ReactMount: Two valid but unequal nodes with the same `%s`: %s', ATTR_NAME, id) : invariant(false) : undefined;

        nodeCache[id] = node;
      }
    } else {
      nodeCache[id] = node;
    }
  }

  return id;
}

function internalGetID(node) {
  // If node is something like a window, document, or text node, none of
  // which support attributes or a .getAttribute method, gracefully return
  // the empty string, as if the attribute were missing.
  return node && node.getAttribute && node.getAttribute(ATTR_NAME) || '';
}

/**
 * Sets the React-specific ID of the given node.
 *
 * @param {DOMElement} node The DOM node whose ID will be set.
 * @param {string} id The value of the ID attribute.
 */
function setID(node, id) {
  var oldID = internalGetID(node);
  if (oldID !== id) {
    delete nodeCache[oldID];
  }
  node.setAttribute(ATTR_NAME, id);
  nodeCache[id] = node;
}

/**
 * Finds the node with the supplied React-generated DOM ID.
 *
 * @param {string} id A React-generated DOM ID.
 * @return {DOMElement} DOM node with the suppled `id`.
 * @internal
 */
function getNode(id) {
  if (!nodeCache.hasOwnProperty(id) || !isValid(nodeCache[id], id)) {
    nodeCache[id] = ReactMount.findReactNodeByID(id);
  }
  return nodeCache[id];
}

/**
 * Finds the node with the supplied public React instance.
 *
 * @param {*} instance A public React instance.
 * @return {?DOMElement} DOM node with the suppled `id`.
 * @internal
 */
function getNodeFromInstance(instance) {
  var id = ReactInstanceMap.get(instance)._rootNodeID;
  if (ReactEmptyComponentRegistry.isNullComponentID(id)) {
    return null;
  }
  if (!nodeCache.hasOwnProperty(id) || !isValid(nodeCache[id], id)) {
    nodeCache[id] = ReactMount.findReactNodeByID(id);
  }
  return nodeCache[id];
}

/**
 * A node is "valid" if it is contained by a currently mounted container.
 *
 * This means that the node does not have to be contained by a document in
 * order to be considered valid.
 *
 * @param {?DOMElement} node The candidate DOM node.
 * @param {string} id The expected ID of the node.
 * @return {boolean} Whether the node is contained by a mounted container.
 */
function isValid(node, id) {
  if (node) {
    !(internalGetID(node) === id) ? "production" !== 'production' ? invariant(false, 'ReactMount: Unexpected modification of `%s`', ATTR_NAME) : invariant(false) : undefined;

    var container = ReactMount.findReactContainerForID(id);
    if (container && containsNode(container, node)) {
      return true;
    }
  }

  return false;
}

/**
 * Causes the cache to forget about one React-specific ID.
 *
 * @param {string} id The ID to forget.
 */
function purgeID(id) {
  delete nodeCache[id];
}

var deepestNodeSoFar = null;
function findDeepestCachedAncestorImpl(ancestorID) {
  var ancestor = nodeCache[ancestorID];
  if (ancestor && isValid(ancestor, ancestorID)) {
    deepestNodeSoFar = ancestor;
  } else {
    // This node isn't populated in the cache, so presumably none of its
    // descendants are. Break out of the loop.
    return false;
  }
}

/**
 * Return the deepest cached node whose ID is a prefix of `targetID`.
 */
function findDeepestCachedAncestor(targetID) {
  deepestNodeSoFar = null;
  ReactInstanceHandles.traverseAncestors(targetID, findDeepestCachedAncestorImpl);

  var foundNode = deepestNodeSoFar;
  deepestNodeSoFar = null;
  return foundNode;
}

/**
 * Mounts this component and inserts it into the DOM.
 *
 * @param {ReactComponent} componentInstance The instance to mount.
 * @param {string} rootID DOM ID of the root node.
 * @param {DOMElement} container DOM element to mount into.
 * @param {ReactReconcileTransaction} transaction
 * @param {boolean} shouldReuseMarkup If true, do not insert markup
 */
function mountComponentIntoNode(componentInstance, rootID, container, transaction, shouldReuseMarkup, context) {
  if (ReactDOMFeatureFlags.useCreateElement) {
    context = assign({}, context);
    if (container.nodeType === DOC_NODE_TYPE) {
      context[ownerDocumentContextKey] = container;
    } else {
      context[ownerDocumentContextKey] = container.ownerDocument;
    }
  }
  if ("production" !== 'production') {
    if (context === emptyObject) {
      context = {};
    }
    var tag = container.nodeName.toLowerCase();
    context[validateDOMNesting.ancestorInfoContextKey] = validateDOMNesting.updatedAncestorInfo(null, tag, null);
  }
  var markup = ReactReconciler.mountComponent(componentInstance, rootID, transaction, context);
  componentInstance._renderedComponent._topLevelWrapper = componentInstance;
  ReactMount._mountImageIntoNode(markup, container, shouldReuseMarkup, transaction);
}

/**
 * Batched mount.
 *
 * @param {ReactComponent} componentInstance The instance to mount.
 * @param {string} rootID DOM ID of the root node.
 * @param {DOMElement} container DOM element to mount into.
 * @param {boolean} shouldReuseMarkup If true, do not insert markup
 */
function batchedMountComponentIntoNode(componentInstance, rootID, container, shouldReuseMarkup, context) {
  var transaction = ReactUpdates.ReactReconcileTransaction.getPooled(
  /* forceHTML */shouldReuseMarkup);
  transaction.perform(mountComponentIntoNode, null, componentInstance, rootID, container, transaction, shouldReuseMarkup, context);
  ReactUpdates.ReactReconcileTransaction.release(transaction);
}

/**
 * Unmounts a component and removes it from the DOM.
 *
 * @param {ReactComponent} instance React component instance.
 * @param {DOMElement} container DOM element to unmount from.
 * @final
 * @internal
 * @see {ReactMount.unmountComponentAtNode}
 */
function unmountComponentFromNode(instance, container) {
  ReactReconciler.unmountComponent(instance);

  if (container.nodeType === DOC_NODE_TYPE) {
    container = container.documentElement;
  }

  // http://jsperf.com/emptying-a-node
  while (container.lastChild) {
    container.removeChild(container.lastChild);
  }
}

/**
 * True if the supplied DOM node has a direct React-rendered child that is
 * not a React root element. Useful for warning in `render`,
 * `unmountComponentAtNode`, etc.
 *
 * @param {?DOMElement} node The candidate DOM node.
 * @return {boolean} True if the DOM element contains a direct child that was
 * rendered by React but is not a root element.
 * @internal
 */
function hasNonRootReactChild(node) {
  var reactRootID = getReactRootID(node);
  return reactRootID ? reactRootID !== ReactInstanceHandles.getReactRootIDFromNodeID(reactRootID) : false;
}

/**
 * Returns the first (deepest) ancestor of a node which is rendered by this copy
 * of React.
 */
function findFirstReactDOMImpl(node) {
  // This node might be from another React instance, so we make sure not to
  // examine the node cache here
  for (; node && node.parentNode !== node; node = node.parentNode) {
    if (node.nodeType !== 1) {
      // Not a DOMElement, therefore not a React component
      continue;
    }
    var nodeID = internalGetID(node);
    if (!nodeID) {
      continue;
    }
    var reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(nodeID);

    // If containersByReactRootID contains the container we find by crawling up
    // the tree, we know that this instance of React rendered the node.
    // nb. isValid's strategy (with containsNode) does not work because render
    // trees may be nested and we don't want a false positive in that case.
    var current = node;
    var lastID;
    do {
      lastID = internalGetID(current);
      current = current.parentNode;
      if (current == null) {
        // The passed-in node has been detached from the container it was
        // originally rendered into.
        return null;
      }
    } while (lastID !== reactRootID);

    if (current === containersByReactRootID[reactRootID]) {
      return node;
    }
  }
  return null;
}

/**
 * Temporary (?) hack so that we can store all top-level pending updates on
 * composites instead of having to worry about different types of components
 * here.
 */
var TopLevelWrapper = function () {};
TopLevelWrapper.prototype.isReactComponent = {};
if ("production" !== 'production') {
  TopLevelWrapper.displayName = 'TopLevelWrapper';
}
TopLevelWrapper.prototype.render = function () {
  // this.props is actually a ReactElement
  return this.props;
};

/**
 * Mounting is the process of initializing a React component by creating its
 * representative DOM elements and inserting them into a supplied `container`.
 * Any prior content inside `container` is destroyed in the process.
 *
 *   ReactMount.render(
 *     component,
 *     document.getElementById('container')
 *   );
 *
 *   <div id="container">                   <-- Supplied `container`.
 *     <div data-reactid=".3">              <-- Rendered reactRoot of React
 *       // ...                                 component.
 *     </div>
 *   </div>
 *
 * Inside of `container`, the first element rendered is the "reactRoot".
 */
var ReactMount = {

  TopLevelWrapper: TopLevelWrapper,

  /** Exposed for debugging purposes **/
  _instancesByReactRootID: instancesByReactRootID,

  /**
   * This is a hook provided to support rendering React components while
   * ensuring that the apparent scroll position of its `container` does not
   * change.
   *
   * @param {DOMElement} container The `container` being rendered into.
   * @param {function} renderCallback This must be called once to do the render.
   */
  scrollMonitor: function (container, renderCallback) {
    renderCallback();
  },

  /**
   * Take a component that's already mounted into the DOM and replace its props
   * @param {ReactComponent} prevComponent component instance already in the DOM
   * @param {ReactElement} nextElement component instance to render
   * @param {DOMElement} container container to render into
   * @param {?function} callback function triggered on completion
   */
  _updateRootComponent: function (prevComponent, nextElement, container, callback) {
    ReactMount.scrollMonitor(container, function () {
      ReactUpdateQueue.enqueueElementInternal(prevComponent, nextElement);
      if (callback) {
        ReactUpdateQueue.enqueueCallbackInternal(prevComponent, callback);
      }
    });

    if ("production" !== 'production') {
      // Record the root element in case it later gets transplanted.
      rootElementsByReactRootID[getReactRootID(container)] = getReactRootElementInContainer(container);
    }

    return prevComponent;
  },

  /**
   * Register a component into the instance map and starts scroll value
   * monitoring
   * @param {ReactComponent} nextComponent component instance to render
   * @param {DOMElement} container container to render into
   * @return {string} reactRoot ID prefix
   */
  _registerComponent: function (nextComponent, container) {
    !(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE || container.nodeType === DOCUMENT_FRAGMENT_NODE_TYPE)) ? "production" !== 'production' ? invariant(false, '_registerComponent(...): Target container is not a DOM element.') : invariant(false) : undefined;

    ReactBrowserEventEmitter.ensureScrollValueMonitoring();

    var reactRootID = ReactMount.registerContainer(container);
    instancesByReactRootID[reactRootID] = nextComponent;
    return reactRootID;
  },

  /**
   * Render a new component into the DOM.
   * @param {ReactElement} nextElement element to render
   * @param {DOMElement} container container to render into
   * @param {boolean} shouldReuseMarkup if we should skip the markup insertion
   * @return {ReactComponent} nextComponent
   */
  _renderNewRootComponent: function (nextElement, container, shouldReuseMarkup, context) {
    // Various parts of our code (such as ReactCompositeComponent's
    // _renderValidatedComponent) assume that calls to render aren't nested;
    // verify that that's the case.
    "production" !== 'production' ? warning(ReactCurrentOwner.current == null, '_renderNewRootComponent(): Render methods should be a pure function ' + 'of props and state; triggering nested component updates from ' + 'render is not allowed. If necessary, trigger nested updates in ' + 'componentDidUpdate. Check the render method of %s.', ReactCurrentOwner.current && ReactCurrentOwner.current.getName() || 'ReactCompositeComponent') : undefined;

    var componentInstance = instantiateReactComponent(nextElement, null);
    var reactRootID = ReactMount._registerComponent(componentInstance, container);

    // The initial render is synchronous but any updates that happen during
    // rendering, in componentWillMount or componentDidMount, will be batched
    // according to the current batching strategy.

    ReactUpdates.batchedUpdates(batchedMountComponentIntoNode, componentInstance, reactRootID, container, shouldReuseMarkup, context);

    if ("production" !== 'production') {
      // Record the root element in case it later gets transplanted.
      rootElementsByReactRootID[reactRootID] = getReactRootElementInContainer(container);
    }

    return componentInstance;
  },

  /**
   * Renders a React component into the DOM in the supplied `container`.
   *
   * If the React component was previously rendered into `container`, this will
   * perform an update on it and only mutate the DOM as necessary to reflect the
   * latest React component.
   *
   * @param {ReactComponent} parentComponent The conceptual parent of this render tree.
   * @param {ReactElement} nextElement Component element to render.
   * @param {DOMElement} container DOM element to render into.
   * @param {?function} callback function triggered on completion
   * @return {ReactComponent} Component instance rendered in `container`.
   */
  renderSubtreeIntoContainer: function (parentComponent, nextElement, container, callback) {
    !(parentComponent != null && parentComponent._reactInternalInstance != null) ? "production" !== 'production' ? invariant(false, 'parentComponent must be a valid React Component') : invariant(false) : undefined;
    return ReactMount._renderSubtreeIntoContainer(parentComponent, nextElement, container, callback);
  },

  _renderSubtreeIntoContainer: function (parentComponent, nextElement, container, callback) {
    !ReactElement.isValidElement(nextElement) ? "production" !== 'production' ? invariant(false, 'ReactDOM.render(): Invalid component element.%s', typeof nextElement === 'string' ? ' Instead of passing an element string, make sure to instantiate ' + 'it by passing it to React.createElement.' : typeof nextElement === 'function' ? ' Instead of passing a component class, make sure to instantiate ' + 'it by passing it to React.createElement.' :
    // Check if it quacks like an element
    nextElement != null && nextElement.props !== undefined ? ' This may be caused by unintentionally loading two independent ' + 'copies of React.' : '') : invariant(false) : undefined;

    "production" !== 'production' ? warning(!container || !container.tagName || container.tagName.toUpperCase() !== 'BODY', 'render(): Rendering components directly into document.body is ' + 'discouraged, since its children are often manipulated by third-party ' + 'scripts and browser extensions. This may lead to subtle ' + 'reconciliation issues. Try rendering into a container element created ' + 'for your app.') : undefined;

    var nextWrappedElement = new ReactElement(TopLevelWrapper, null, null, null, null, null, nextElement);

    var prevComponent = instancesByReactRootID[getReactRootID(container)];

    if (prevComponent) {
      var prevWrappedElement = prevComponent._currentElement;
      var prevElement = prevWrappedElement.props;
      if (shouldUpdateReactComponent(prevElement, nextElement)) {
        var publicInst = prevComponent._renderedComponent.getPublicInstance();
        var updatedCallback = callback && function () {
          callback.call(publicInst);
        };
        ReactMount._updateRootComponent(prevComponent, nextWrappedElement, container, updatedCallback);
        return publicInst;
      } else {
        ReactMount.unmountComponentAtNode(container);
      }
    }

    var reactRootElement = getReactRootElementInContainer(container);
    var containerHasReactMarkup = reactRootElement && !!internalGetID(reactRootElement);
    var containerHasNonRootReactChild = hasNonRootReactChild(container);

    if ("production" !== 'production') {
      "production" !== 'production' ? warning(!containerHasNonRootReactChild, 'render(...): Replacing React-rendered children with a new root ' + 'component. If you intended to update the children of this node, ' + 'you should instead have the existing children update their state ' + 'and render the new components instead of calling ReactDOM.render.') : undefined;

      if (!containerHasReactMarkup || reactRootElement.nextSibling) {
        var rootElementSibling = reactRootElement;
        while (rootElementSibling) {
          if (internalGetID(rootElementSibling)) {
            "production" !== 'production' ? warning(false, 'render(): Target node has markup rendered by React, but there ' + 'are unrelated nodes as well. This is most commonly caused by ' + 'white-space inserted around server-rendered markup.') : undefined;
            break;
          }
          rootElementSibling = rootElementSibling.nextSibling;
        }
      }
    }

    var shouldReuseMarkup = containerHasReactMarkup && !prevComponent && !containerHasNonRootReactChild;
    var component = ReactMount._renderNewRootComponent(nextWrappedElement, container, shouldReuseMarkup, parentComponent != null ? parentComponent._reactInternalInstance._processChildContext(parentComponent._reactInternalInstance._context) : emptyObject)._renderedComponent.getPublicInstance();
    if (callback) {
      callback.call(component);
    }
    return component;
  },

  /**
   * Renders a React component into the DOM in the supplied `container`.
   *
   * If the React component was previously rendered into `container`, this will
   * perform an update on it and only mutate the DOM as necessary to reflect the
   * latest React component.
   *
   * @param {ReactElement} nextElement Component element to render.
   * @param {DOMElement} container DOM element to render into.
   * @param {?function} callback function triggered on completion
   * @return {ReactComponent} Component instance rendered in `container`.
   */
  render: function (nextElement, container, callback) {
    return ReactMount._renderSubtreeIntoContainer(null, nextElement, container, callback);
  },

  /**
   * Registers a container node into which React components will be rendered.
   * This also creates the "reactRoot" ID that will be assigned to the element
   * rendered within.
   *
   * @param {DOMElement} container DOM element to register as a container.
   * @return {string} The "reactRoot" ID of elements rendered within.
   */
  registerContainer: function (container) {
    var reactRootID = getReactRootID(container);
    if (reactRootID) {
      // If one exists, make sure it is a valid "reactRoot" ID.
      reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(reactRootID);
    }
    if (!reactRootID) {
      // No valid "reactRoot" ID found, create one.
      reactRootID = ReactInstanceHandles.createReactRootID();
    }
    containersByReactRootID[reactRootID] = container;
    return reactRootID;
  },

  /**
   * Unmounts and destroys the React component rendered in the `container`.
   *
   * @param {DOMElement} container DOM element containing a React component.
   * @return {boolean} True if a component was found in and unmounted from
   *                   `container`
   */
  unmountComponentAtNode: function (container) {
    // Various parts of our code (such as ReactCompositeComponent's
    // _renderValidatedComponent) assume that calls to render aren't nested;
    // verify that that's the case. (Strictly speaking, unmounting won't cause a
    // render but we still don't expect to be in a render call here.)
    "production" !== 'production' ? warning(ReactCurrentOwner.current == null, 'unmountComponentAtNode(): Render methods should be a pure function ' + 'of props and state; triggering nested component updates from render ' + 'is not allowed. If necessary, trigger nested updates in ' + 'componentDidUpdate. Check the render method of %s.', ReactCurrentOwner.current && ReactCurrentOwner.current.getName() || 'ReactCompositeComponent') : undefined;

    !(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE || container.nodeType === DOCUMENT_FRAGMENT_NODE_TYPE)) ? "production" !== 'production' ? invariant(false, 'unmountComponentAtNode(...): Target container is not a DOM element.') : invariant(false) : undefined;

    var reactRootID = getReactRootID(container);
    var component = instancesByReactRootID[reactRootID];
    if (!component) {
      // Check if the node being unmounted was rendered by React, but isn't a
      // root node.
      var containerHasNonRootReactChild = hasNonRootReactChild(container);

      // Check if the container itself is a React root node.
      var containerID = internalGetID(container);
      var isContainerReactRoot = containerID && containerID === ReactInstanceHandles.getReactRootIDFromNodeID(containerID);

      if ("production" !== 'production') {
        "production" !== 'production' ? warning(!containerHasNonRootReactChild, 'unmountComponentAtNode(): The node you\'re attempting to unmount ' + 'was rendered by React and is not a top-level container. %s', isContainerReactRoot ? 'You may have accidentally passed in a React root node instead ' + 'of its container.' : 'Instead, have the parent component update its state and ' + 'rerender in order to remove this component.') : undefined;
      }

      return false;
    }
    ReactUpdates.batchedUpdates(unmountComponentFromNode, component, container);
    delete instancesByReactRootID[reactRootID];
    delete containersByReactRootID[reactRootID];
    if ("production" !== 'production') {
      delete rootElementsByReactRootID[reactRootID];
    }
    return true;
  },

  /**
   * Finds the container DOM element that contains React component to which the
   * supplied DOM `id` belongs.
   *
   * @param {string} id The ID of an element rendered by a React component.
   * @return {?DOMElement} DOM element that contains the `id`.
   */
  findReactContainerForID: function (id) {
    var reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(id);
    var container = containersByReactRootID[reactRootID];

    if ("production" !== 'production') {
      var rootElement = rootElementsByReactRootID[reactRootID];
      if (rootElement && rootElement.parentNode !== container) {
        "production" !== 'production' ? warning(
        // Call internalGetID here because getID calls isValid which calls
        // findReactContainerForID (this function).
        internalGetID(rootElement) === reactRootID, 'ReactMount: Root element ID differed from reactRootID.') : undefined;
        var containerChild = container.firstChild;
        if (containerChild && reactRootID === internalGetID(containerChild)) {
          // If the container has a new child with the same ID as the old
          // root element, then rootElementsByReactRootID[reactRootID] is
          // just stale and needs to be updated. The case that deserves a
          // warning is when the container is empty.
          rootElementsByReactRootID[reactRootID] = containerChild;
        } else {
          "production" !== 'production' ? warning(false, 'ReactMount: Root element has been removed from its original ' + 'container. New container: %s', rootElement.parentNode) : undefined;
        }
      }
    }

    return container;
  },

  /**
   * Finds an element rendered by React with the supplied ID.
   *
   * @param {string} id ID of a DOM node in the React component.
   * @return {DOMElement} Root DOM node of the React component.
   */
  findReactNodeByID: function (id) {
    var reactRoot = ReactMount.findReactContainerForID(id);
    return ReactMount.findComponentRoot(reactRoot, id);
  },

  /**
   * Traverses up the ancestors of the supplied node to find a node that is a
   * DOM representation of a React component rendered by this copy of React.
   *
   * @param {*} node
   * @return {?DOMEventTarget}
   * @internal
   */
  getFirstReactDOM: function (node) {
    return findFirstReactDOMImpl(node);
  },

  /**
   * Finds a node with the supplied `targetID` inside of the supplied
   * `ancestorNode`.  Exploits the ID naming scheme to perform the search
   * quickly.
   *
   * @param {DOMEventTarget} ancestorNode Search from this root.
   * @pararm {string} targetID ID of the DOM representation of the component.
   * @return {DOMEventTarget} DOM node with the supplied `targetID`.
   * @internal
   */
  findComponentRoot: function (ancestorNode, targetID) {
    var firstChildren = findComponentRootReusableArray;
    var childIndex = 0;

    var deepestAncestor = findDeepestCachedAncestor(targetID) || ancestorNode;

    if ("production" !== 'production') {
      // This will throw on the next line; give an early warning
      "production" !== 'production' ? warning(deepestAncestor != null, 'React can\'t find the root component node for data-reactid value ' + '`%s`. If you\'re seeing this message, it probably means that ' + 'you\'ve loaded two copies of React on the page. At this time, only ' + 'a single copy of React can be loaded at a time.', targetID) : undefined;
    }

    firstChildren[0] = deepestAncestor.firstChild;
    firstChildren.length = 1;

    while (childIndex < firstChildren.length) {
      var child = firstChildren[childIndex++];
      var targetChild;

      while (child) {
        var childID = ReactMount.getID(child);
        if (childID) {
          // Even if we find the node we're looking for, we finish looping
          // through its siblings to ensure they're cached so that we don't have
          // to revisit this node again. Otherwise, we make n^2 calls to getID
          // when visiting the many children of a single node in order.

          if (targetID === childID) {
            targetChild = child;
          } else if (ReactInstanceHandles.isAncestorIDOf(childID, targetID)) {
            // If we find a child whose ID is an ancestor of the given ID,
            // then we can be sure that we only want to search the subtree
            // rooted at this child, so we can throw out the rest of the
            // search state.
            firstChildren.length = childIndex = 0;
            firstChildren.push(child.firstChild);
          }
        } else {
          // If this child had no ID, then there's a chance that it was
          // injected automatically by the browser, as when a `<table>`
          // element sprouts an extra `<tbody>` child as a side effect of
          // `.innerHTML` parsing. Optimistically continue down this
          // branch, but not before examining the other siblings.
          firstChildren.push(child.firstChild);
        }

        child = child.nextSibling;
      }

      if (targetChild) {
        // Emptying firstChildren/findComponentRootReusableArray is
        // not necessary for correctness, but it helps the GC reclaim
        // any nodes that were left at the end of the search.
        firstChildren.length = 0;

        return targetChild;
      }
    }

    firstChildren.length = 0;

    !false ? "production" !== 'production' ? invariant(false, 'findComponentRoot(..., %s): Unable to find element. This probably ' + 'means the DOM was unexpectedly mutated (e.g., by the browser), ' + 'usually due to forgetting a <tbody> when using tables, nesting tags ' + 'like <form>, <p>, or <a>, or using non-SVG elements in an <svg> ' + 'parent. ' + 'Try inspecting the child nodes of the element with React ID `%s`.', targetID, ReactMount.getID(ancestorNode)) : invariant(false) : undefined;
  },

  _mountImageIntoNode: function (markup, container, shouldReuseMarkup, transaction) {
    !(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE || container.nodeType === DOCUMENT_FRAGMENT_NODE_TYPE)) ? "production" !== 'production' ? invariant(false, 'mountComponentIntoNode(...): Target container is not valid.') : invariant(false) : undefined;

    if (shouldReuseMarkup) {
      var rootElement = getReactRootElementInContainer(container);
      if (ReactMarkupChecksum.canReuseMarkup(markup, rootElement)) {
        return;
      } else {
        var checksum = rootElement.getAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME);
        rootElement.removeAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME);

        var rootMarkup = rootElement.outerHTML;
        rootElement.setAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME, checksum);

        var normalizedMarkup = markup;
        if ("production" !== 'production') {
          // because rootMarkup is retrieved from the DOM, various normalizations
          // will have occurred which will not be present in `markup`. Here,
          // insert markup into a <div> or <iframe> depending on the container
          // type to perform the same normalizations before comparing.
          var normalizer;
          if (container.nodeType === ELEMENT_NODE_TYPE) {
            normalizer = document.createElement('div');
            normalizer.innerHTML = markup;
            normalizedMarkup = normalizer.innerHTML;
          } else {
            normalizer = document.createElement('iframe');
            document.body.appendChild(normalizer);
            normalizer.contentDocument.write(markup);
            normalizedMarkup = normalizer.contentDocument.documentElement.outerHTML;
            document.body.removeChild(normalizer);
          }
        }

        var diffIndex = firstDifferenceIndex(normalizedMarkup, rootMarkup);
        var difference = ' (client) ' + normalizedMarkup.substring(diffIndex - 20, diffIndex + 20) + '\n (server) ' + rootMarkup.substring(diffIndex - 20, diffIndex + 20);

        !(container.nodeType !== DOC_NODE_TYPE) ? "production" !== 'production' ? invariant(false, 'You\'re trying to render a component to the document using ' + 'server rendering but the checksum was invalid. This usually ' + 'means you rendered a different component type or props on ' + 'the client from the one on the server, or your render() ' + 'methods are impure. React cannot handle this case due to ' + 'cross-browser quirks by rendering at the document root. You ' + 'should look for environment dependent code in your components ' + 'and ensure the props are the same client and server side:\n%s', difference) : invariant(false) : undefined;

        if ("production" !== 'production') {
          "production" !== 'production' ? warning(false, 'React attempted to reuse markup in a container but the ' + 'checksum was invalid. This generally means that you are ' + 'using server rendering and the markup generated on the ' + 'server was not what the client was expecting. React injected ' + 'new markup to compensate which works but you have lost many ' + 'of the benefits of server rendering. Instead, figure out ' + 'why the markup being generated is different on the client ' + 'or server:\n%s', difference) : undefined;
        }
      }
    }

    !(container.nodeType !== DOC_NODE_TYPE) ? "production" !== 'production' ? invariant(false, 'You\'re trying to render a component to the document but ' + 'you didn\'t use server rendering. We can\'t do this ' + 'without using server rendering due to cross-browser quirks. ' + 'See ReactDOMServer.renderToString() for server rendering.') : invariant(false) : undefined;

    if (transaction.useCreateElement) {
      while (container.lastChild) {
        container.removeChild(container.lastChild);
      }
      container.appendChild(markup);
    } else {
      setInnerHTML(container, markup);
    }
  },

  ownerDocumentContextKey: ownerDocumentContextKey,

  /**
   * React ID utilities.
   */

  getReactRootID: getReactRootID,

  getID: getID,

  setID: setID,

  getNode: getNode,

  getNodeFromInstance: getNodeFromInstance,

  isValid: isValid,

  purgeID: purgeID
};

ReactPerf.measureMethods(ReactMount, 'ReactMount', {
  _renderNewRootComponent: '_renderNewRootComponent',
  _mountImageIntoNode: '_mountImageIntoNode'
});

module.exports = ReactMount;
},{"./DOMProperty":65,"./Object.assign":78,"./ReactBrowserEventEmitter":82,"./ReactCurrentOwner":90,"./ReactDOMFeatureFlags":95,"./ReactElement":108,"./ReactEmptyComponentRegistry":111,"./ReactInstanceHandles":117,"./ReactInstanceMap":118,"./ReactMarkupChecksum":120,"./ReactPerf":127,"./ReactReconciler":132,"./ReactUpdateQueue":138,"./ReactUpdates":139,"./instantiateReactComponent":174,"./setInnerHTML":180,"./shouldUpdateReactComponent":182,"./validateDOMNesting":184,"fbjs/lib/containsNode":189,"fbjs/lib/emptyObject":193,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],122:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMultiChild
 * @typechecks static-only
 */

'use strict';

var ReactComponentEnvironment = require('./ReactComponentEnvironment');
var ReactMultiChildUpdateTypes = require('./ReactMultiChildUpdateTypes');

var ReactCurrentOwner = require('./ReactCurrentOwner');
var ReactReconciler = require('./ReactReconciler');
var ReactChildReconciler = require('./ReactChildReconciler');

var flattenChildren = require('./flattenChildren');

/**
 * Updating children of a component may trigger recursive updates. The depth is
 * used to batch recursive updates to render markup more efficiently.
 *
 * @type {number}
 * @private
 */
var updateDepth = 0;

/**
 * Queue of update configuration objects.
 *
 * Each object has a `type` property that is in `ReactMultiChildUpdateTypes`.
 *
 * @type {array<object>}
 * @private
 */
var updateQueue = [];

/**
 * Queue of markup to be rendered.
 *
 * @type {array<string>}
 * @private
 */
var markupQueue = [];

/**
 * Enqueues markup to be rendered and inserted at a supplied index.
 *
 * @param {string} parentID ID of the parent component.
 * @param {string} markup Markup that renders into an element.
 * @param {number} toIndex Destination index.
 * @private
 */
function enqueueInsertMarkup(parentID, markup, toIndex) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.INSERT_MARKUP,
    markupIndex: markupQueue.push(markup) - 1,
    content: null,
    fromIndex: null,
    toIndex: toIndex
  });
}

/**
 * Enqueues moving an existing element to another index.
 *
 * @param {string} parentID ID of the parent component.
 * @param {number} fromIndex Source index of the existing element.
 * @param {number} toIndex Destination index of the element.
 * @private
 */
function enqueueMove(parentID, fromIndex, toIndex) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.MOVE_EXISTING,
    markupIndex: null,
    content: null,
    fromIndex: fromIndex,
    toIndex: toIndex
  });
}

/**
 * Enqueues removing an element at an index.
 *
 * @param {string} parentID ID of the parent component.
 * @param {number} fromIndex Index of the element to remove.
 * @private
 */
function enqueueRemove(parentID, fromIndex) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.REMOVE_NODE,
    markupIndex: null,
    content: null,
    fromIndex: fromIndex,
    toIndex: null
  });
}

/**
 * Enqueues setting the markup of a node.
 *
 * @param {string} parentID ID of the parent component.
 * @param {string} markup Markup that renders into an element.
 * @private
 */
function enqueueSetMarkup(parentID, markup) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.SET_MARKUP,
    markupIndex: null,
    content: markup,
    fromIndex: null,
    toIndex: null
  });
}

/**
 * Enqueues setting the text content.
 *
 * @param {string} parentID ID of the parent component.
 * @param {string} textContent Text content to set.
 * @private
 */
function enqueueTextContent(parentID, textContent) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.TEXT_CONTENT,
    markupIndex: null,
    content: textContent,
    fromIndex: null,
    toIndex: null
  });
}

/**
 * Processes any enqueued updates.
 *
 * @private
 */
function processQueue() {
  if (updateQueue.length) {
    ReactComponentEnvironment.processChildrenUpdates(updateQueue, markupQueue);
    clearQueue();
  }
}

/**
 * Clears any enqueued updates.
 *
 * @private
 */
function clearQueue() {
  updateQueue.length = 0;
  markupQueue.length = 0;
}

/**
 * ReactMultiChild are capable of reconciling multiple children.
 *
 * @class ReactMultiChild
 * @internal
 */
var ReactMultiChild = {

  /**
   * Provides common functionality for components that must reconcile multiple
   * children. This is used by `ReactDOMComponent` to mount, update, and
   * unmount child components.
   *
   * @lends {ReactMultiChild.prototype}
   */
  Mixin: {

    _reconcilerInstantiateChildren: function (nestedChildren, transaction, context) {
      if ("production" !== 'production') {
        if (this._currentElement) {
          try {
            ReactCurrentOwner.current = this._currentElement._owner;
            return ReactChildReconciler.instantiateChildren(nestedChildren, transaction, context);
          } finally {
            ReactCurrentOwner.current = null;
          }
        }
      }
      return ReactChildReconciler.instantiateChildren(nestedChildren, transaction, context);
    },

    _reconcilerUpdateChildren: function (prevChildren, nextNestedChildrenElements, transaction, context) {
      var nextChildren;
      if ("production" !== 'production') {
        if (this._currentElement) {
          try {
            ReactCurrentOwner.current = this._currentElement._owner;
            nextChildren = flattenChildren(nextNestedChildrenElements);
          } finally {
            ReactCurrentOwner.current = null;
          }
          return ReactChildReconciler.updateChildren(prevChildren, nextChildren, transaction, context);
        }
      }
      nextChildren = flattenChildren(nextNestedChildrenElements);
      return ReactChildReconciler.updateChildren(prevChildren, nextChildren, transaction, context);
    },

    /**
     * Generates a "mount image" for each of the supplied children. In the case
     * of `ReactDOMComponent`, a mount image is a string of markup.
     *
     * @param {?object} nestedChildren Nested child maps.
     * @return {array} An array of mounted representations.
     * @internal
     */
    mountChildren: function (nestedChildren, transaction, context) {
      var children = this._reconcilerInstantiateChildren(nestedChildren, transaction, context);
      this._renderedChildren = children;
      var mountImages = [];
      var index = 0;
      for (var name in children) {
        if (children.hasOwnProperty(name)) {
          var child = children[name];
          // Inlined for performance, see `ReactInstanceHandles.createReactID`.
          var rootID = this._rootNodeID + name;
          var mountImage = ReactReconciler.mountComponent(child, rootID, transaction, context);
          child._mountIndex = index++;
          mountImages.push(mountImage);
        }
      }
      return mountImages;
    },

    /**
     * Replaces any rendered children with a text content string.
     *
     * @param {string} nextContent String of content.
     * @internal
     */
    updateTextContent: function (nextContent) {
      updateDepth++;
      var errorThrown = true;
      try {
        var prevChildren = this._renderedChildren;
        // Remove any rendered children.
        ReactChildReconciler.unmountChildren(prevChildren);
        // TODO: The setTextContent operation should be enough
        for (var name in prevChildren) {
          if (prevChildren.hasOwnProperty(name)) {
            this._unmountChild(prevChildren[name]);
          }
        }
        // Set new text content.
        this.setTextContent(nextContent);
        errorThrown = false;
      } finally {
        updateDepth--;
        if (!updateDepth) {
          if (errorThrown) {
            clearQueue();
          } else {
            processQueue();
          }
        }
      }
    },

    /**
     * Replaces any rendered children with a markup string.
     *
     * @param {string} nextMarkup String of markup.
     * @internal
     */
    updateMarkup: function (nextMarkup) {
      updateDepth++;
      var errorThrown = true;
      try {
        var prevChildren = this._renderedChildren;
        // Remove any rendered children.
        ReactChildReconciler.unmountChildren(prevChildren);
        for (var name in prevChildren) {
          if (prevChildren.hasOwnProperty(name)) {
            this._unmountChildByName(prevChildren[name], name);
          }
        }
        this.setMarkup(nextMarkup);
        errorThrown = false;
      } finally {
        updateDepth--;
        if (!updateDepth) {
          if (errorThrown) {
            clearQueue();
          } else {
            processQueue();
          }
        }
      }
    },

    /**
     * Updates the rendered children with new children.
     *
     * @param {?object} nextNestedChildrenElements Nested child element maps.
     * @param {ReactReconcileTransaction} transaction
     * @internal
     */
    updateChildren: function (nextNestedChildrenElements, transaction, context) {
      updateDepth++;
      var errorThrown = true;
      try {
        this._updateChildren(nextNestedChildrenElements, transaction, context);
        errorThrown = false;
      } finally {
        updateDepth--;
        if (!updateDepth) {
          if (errorThrown) {
            clearQueue();
          } else {
            processQueue();
          }
        }
      }
    },

    /**
     * Improve performance by isolating this hot code path from the try/catch
     * block in `updateChildren`.
     *
     * @param {?object} nextNestedChildrenElements Nested child element maps.
     * @param {ReactReconcileTransaction} transaction
     * @final
     * @protected
     */
    _updateChildren: function (nextNestedChildrenElements, transaction, context) {
      var prevChildren = this._renderedChildren;
      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, transaction, context);
      this._renderedChildren = nextChildren;
      if (!nextChildren && !prevChildren) {
        return;
      }
      var name;
      // `nextIndex` will increment for each child in `nextChildren`, but
      // `lastIndex` will be the last index visited in `prevChildren`.
      var lastIndex = 0;
      var nextIndex = 0;
      for (name in nextChildren) {
        if (!nextChildren.hasOwnProperty(name)) {
          continue;
        }
        var prevChild = prevChildren && prevChildren[name];
        var nextChild = nextChildren[name];
        if (prevChild === nextChild) {
          this.moveChild(prevChild, nextIndex, lastIndex);
          lastIndex = Math.max(prevChild._mountIndex, lastIndex);
          prevChild._mountIndex = nextIndex;
        } else {
          if (prevChild) {
            // Update `lastIndex` before `_mountIndex` gets unset by unmounting.
            lastIndex = Math.max(prevChild._mountIndex, lastIndex);
            this._unmountChild(prevChild);
          }
          // The child must be instantiated before it's mounted.
          this._mountChildByNameAtIndex(nextChild, name, nextIndex, transaction, context);
        }
        nextIndex++;
      }
      // Remove children that are no longer present.
      for (name in prevChildren) {
        if (prevChildren.hasOwnProperty(name) && !(nextChildren && nextChildren.hasOwnProperty(name))) {
          this._unmountChild(prevChildren[name]);
        }
      }
    },

    /**
     * Unmounts all rendered children. This should be used to clean up children
     * when this component is unmounted.
     *
     * @internal
     */
    unmountChildren: function () {
      var renderedChildren = this._renderedChildren;
      ReactChildReconciler.unmountChildren(renderedChildren);
      this._renderedChildren = null;
    },

    /**
     * Moves a child component to the supplied index.
     *
     * @param {ReactComponent} child Component to move.
     * @param {number} toIndex Destination index of the element.
     * @param {number} lastIndex Last index visited of the siblings of `child`.
     * @protected
     */
    moveChild: function (child, toIndex, lastIndex) {
      // If the index of `child` is less than `lastIndex`, then it needs to
      // be moved. Otherwise, we do not need to move it because a child will be
      // inserted or moved before `child`.
      if (child._mountIndex < lastIndex) {
        enqueueMove(this._rootNodeID, child._mountIndex, toIndex);
      }
    },

    /**
     * Creates a child component.
     *
     * @param {ReactComponent} child Component to create.
     * @param {string} mountImage Markup to insert.
     * @protected
     */
    createChild: function (child, mountImage) {
      enqueueInsertMarkup(this._rootNodeID, mountImage, child._mountIndex);
    },

    /**
     * Removes a child component.
     *
     * @param {ReactComponent} child Child to remove.
     * @protected
     */
    removeChild: function (child) {
      enqueueRemove(this._rootNodeID, child._mountIndex);
    },

    /**
     * Sets this text content string.
     *
     * @param {string} textContent Text content to set.
     * @protected
     */
    setTextContent: function (textContent) {
      enqueueTextContent(this._rootNodeID, textContent);
    },

    /**
     * Sets this markup string.
     *
     * @param {string} markup Markup to set.
     * @protected
     */
    setMarkup: function (markup) {
      enqueueSetMarkup(this._rootNodeID, markup);
    },

    /**
     * Mounts a child with the supplied name.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to mount.
     * @param {string} name Name of the child.
     * @param {number} index Index at which to insert the child.
     * @param {ReactReconcileTransaction} transaction
     * @private
     */
    _mountChildByNameAtIndex: function (child, name, index, transaction, context) {
      // Inlined for performance, see `ReactInstanceHandles.createReactID`.
      var rootID = this._rootNodeID + name;
      var mountImage = ReactReconciler.mountComponent(child, rootID, transaction, context);
      child._mountIndex = index;
      this.createChild(child, mountImage);
    },

    /**
     * Unmounts a rendered child.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to unmount.
     * @private
     */
    _unmountChild: function (child) {
      this.removeChild(child);
      child._mountIndex = null;
    }

  }

};

module.exports = ReactMultiChild;
},{"./ReactChildReconciler":83,"./ReactComponentEnvironment":88,"./ReactCurrentOwner":90,"./ReactMultiChildUpdateTypes":123,"./ReactReconciler":132,"./flattenChildren":165}],123:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMultiChildUpdateTypes
 */

'use strict';

var keyMirror = require('fbjs/lib/keyMirror');

/**
 * When a component's children are updated, a series of update configuration
 * objects are created in order to batch and serialize the required changes.
 *
 * Enumerates all the possible types of update configurations.
 *
 * @internal
 */
var ReactMultiChildUpdateTypes = keyMirror({
  INSERT_MARKUP: null,
  MOVE_EXISTING: null,
  REMOVE_NODE: null,
  SET_MARKUP: null,
  TEXT_CONTENT: null
});

module.exports = ReactMultiChildUpdateTypes;
},{"fbjs/lib/keyMirror":203}],124:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactNativeComponent
 */

'use strict';

var assign = require('./Object.assign');
var invariant = require('fbjs/lib/invariant');

var autoGenerateWrapperClass = null;
var genericComponentClass = null;
// This registry keeps track of wrapper classes around native tags.
var tagToComponentClass = {};
var textComponentClass = null;

var ReactNativeComponentInjection = {
  // This accepts a class that receives the tag string. This is a catch all
  // that can render any kind of tag.
  injectGenericComponentClass: function (componentClass) {
    genericComponentClass = componentClass;
  },
  // This accepts a text component class that takes the text string to be
  // rendered as props.
  injectTextComponentClass: function (componentClass) {
    textComponentClass = componentClass;
  },
  // This accepts a keyed object with classes as values. Each key represents a
  // tag. That particular tag will use this class instead of the generic one.
  injectComponentClasses: function (componentClasses) {
    assign(tagToComponentClass, componentClasses);
  }
};

/**
 * Get a composite component wrapper class for a specific tag.
 *
 * @param {ReactElement} element The tag for which to get the class.
 * @return {function} The React class constructor function.
 */
function getComponentClassForElement(element) {
  if (typeof element.type === 'function') {
    return element.type;
  }
  var tag = element.type;
  var componentClass = tagToComponentClass[tag];
  if (componentClass == null) {
    tagToComponentClass[tag] = componentClass = autoGenerateWrapperClass(tag);
  }
  return componentClass;
}

/**
 * Get a native internal component class for a specific tag.
 *
 * @param {ReactElement} element The element to create.
 * @return {function} The internal class constructor function.
 */
function createInternalComponent(element) {
  !genericComponentClass ? "production" !== 'production' ? invariant(false, 'There is no registered component for the tag %s', element.type) : invariant(false) : undefined;
  return new genericComponentClass(element.type, element.props);
}

/**
 * @param {ReactText} text
 * @return {ReactComponent}
 */
function createInstanceForText(text) {
  return new textComponentClass(text);
}

/**
 * @param {ReactComponent} component
 * @return {boolean}
 */
function isTextComponent(component) {
  return component instanceof textComponentClass;
}

var ReactNativeComponent = {
  getComponentClassForElement: getComponentClassForElement,
  createInternalComponent: createInternalComponent,
  createInstanceForText: createInstanceForText,
  isTextComponent: isTextComponent,
  injection: ReactNativeComponentInjection
};

module.exports = ReactNativeComponent;
},{"./Object.assign":78,"fbjs/lib/invariant":200}],125:[function(require,module,exports){
/**
 * Copyright 2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactNoopUpdateQueue
 */

'use strict';

var warning = require('fbjs/lib/warning');

function warnTDZ(publicInstance, callerName) {
  if ("production" !== 'production') {
    "production" !== 'production' ? warning(false, '%s(...): Can only update a mounted or mounting component. ' + 'This usually means you called %s() on an unmounted component. ' + 'This is a no-op. Please check the code for the %s component.', callerName, callerName, publicInstance.constructor && publicInstance.constructor.displayName || '') : undefined;
  }
}

/**
 * This is the abstract API for an update queue.
 */
var ReactNoopUpdateQueue = {

  /**
   * Checks whether or not this composite component is mounted.
   * @param {ReactClass} publicInstance The instance we want to test.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  isMounted: function (publicInstance) {
    return false;
  },

  /**
   * Enqueue a callback that will be executed after all the pending updates
   * have processed.
   *
   * @param {ReactClass} publicInstance The instance to use as `this` context.
   * @param {?function} callback Called after state is updated.
   * @internal
   */
  enqueueCallback: function (publicInstance, callback) {},

  /**
   * Forces an update. This should only be invoked when it is known with
   * certainty that we are **not** in a DOM transaction.
   *
   * You may want to call this when you know that some deeper aspect of the
   * component's state has changed but `setState` was not called.
   *
   * This will not invoke `shouldComponentUpdate`, but it will invoke
   * `componentWillUpdate` and `componentDidUpdate`.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @internal
   */
  enqueueForceUpdate: function (publicInstance) {
    warnTDZ(publicInstance, 'forceUpdate');
  },

  /**
   * Replaces all of the state. Always use this or `setState` to mutate state.
   * You should treat `this.state` as immutable.
   *
   * There is no guarantee that `this.state` will be immediately updated, so
   * accessing `this.state` after calling this method may return the old value.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} completeState Next state.
   * @internal
   */
  enqueueReplaceState: function (publicInstance, completeState) {
    warnTDZ(publicInstance, 'replaceState');
  },

  /**
   * Sets a subset of the state. This only exists because _pendingState is
   * internal. This provides a merging strategy that is not available to deep
   * properties which is confusing. TODO: Expose pendingState or don't use it
   * during the merge.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} partialState Next partial state to be merged with state.
   * @internal
   */
  enqueueSetState: function (publicInstance, partialState) {
    warnTDZ(publicInstance, 'setState');
  },

  /**
   * Sets a subset of the props.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} partialProps Subset of the next props.
   * @internal
   */
  enqueueSetProps: function (publicInstance, partialProps) {
    warnTDZ(publicInstance, 'setProps');
  },

  /**
   * Replaces all of the props.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} props New props.
   * @internal
   */
  enqueueReplaceProps: function (publicInstance, props) {
    warnTDZ(publicInstance, 'replaceProps');
  }

};

module.exports = ReactNoopUpdateQueue;
},{"fbjs/lib/warning":211}],126:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactOwner
 */

'use strict';

var invariant = require('fbjs/lib/invariant');

/**
 * ReactOwners are capable of storing references to owned components.
 *
 * All components are capable of //being// referenced by owner components, but
 * only ReactOwner components are capable of //referencing// owned components.
 * The named reference is known as a "ref".
 *
 * Refs are available when mounted and updated during reconciliation.
 *
 *   var MyComponent = React.createClass({
 *     render: function() {
 *       return (
 *         <div onClick={this.handleClick}>
 *           <CustomComponent ref="custom" />
 *         </div>
 *       );
 *     },
 *     handleClick: function() {
 *       this.refs.custom.handleClick();
 *     },
 *     componentDidMount: function() {
 *       this.refs.custom.initialize();
 *     }
 *   });
 *
 * Refs should rarely be used. When refs are used, they should only be done to
 * control data that is not handled by React's data flow.
 *
 * @class ReactOwner
 */
var ReactOwner = {

  /**
   * @param {?object} object
   * @return {boolean} True if `object` is a valid owner.
   * @final
   */
  isValidOwner: function (object) {
    return !!(object && typeof object.attachRef === 'function' && typeof object.detachRef === 'function');
  },

  /**
   * Adds a component by ref to an owner component.
   *
   * @param {ReactComponent} component Component to reference.
   * @param {string} ref Name by which to refer to the component.
   * @param {ReactOwner} owner Component on which to record the ref.
   * @final
   * @internal
   */
  addComponentAsRefTo: function (component, ref, owner) {
    !ReactOwner.isValidOwner(owner) ? "production" !== 'production' ? invariant(false, 'addComponentAsRefTo(...): Only a ReactOwner can have refs. You might ' + 'be adding a ref to a component that was not created inside a component\'s ' + '`render` method, or you have multiple copies of React loaded ' + '(details: https://fb.me/react-refs-must-have-owner).') : invariant(false) : undefined;
    owner.attachRef(ref, component);
  },

  /**
   * Removes a component by ref from an owner component.
   *
   * @param {ReactComponent} component Component to dereference.
   * @param {string} ref Name of the ref to remove.
   * @param {ReactOwner} owner Component on which the ref is recorded.
   * @final
   * @internal
   */
  removeComponentAsRefFrom: function (component, ref, owner) {
    !ReactOwner.isValidOwner(owner) ? "production" !== 'production' ? invariant(false, 'removeComponentAsRefFrom(...): Only a ReactOwner can have refs. You might ' + 'be removing a ref to a component that was not created inside a component\'s ' + '`render` method, or you have multiple copies of React loaded ' + '(details: https://fb.me/react-refs-must-have-owner).') : invariant(false) : undefined;
    // Check that `component` is still the current ref because we do not want to
    // detach the ref if another component stole it.
    if (owner.getPublicInstance().refs[ref] === component.getPublicInstance()) {
      owner.detachRef(ref);
    }
  }

};

module.exports = ReactOwner;
},{"fbjs/lib/invariant":200}],127:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactPerf
 * @typechecks static-only
 */

'use strict';

/**
 * ReactPerf is a general AOP system designed to measure performance. This
 * module only has the hooks: see ReactDefaultPerf for the analysis tool.
 */
var ReactPerf = {
  /**
   * Boolean to enable/disable measurement. Set to false by default to prevent
   * accidental logging and perf loss.
   */
  enableMeasure: false,

  /**
   * Holds onto the measure function in use. By default, don't measure
   * anything, but we'll override this if we inject a measure function.
   */
  storedMeasure: _noMeasure,

  /**
   * @param {object} object
   * @param {string} objectName
   * @param {object<string>} methodNames
   */
  measureMethods: function (object, objectName, methodNames) {
    if ("production" !== 'production') {
      for (var key in methodNames) {
        if (!methodNames.hasOwnProperty(key)) {
          continue;
        }
        object[key] = ReactPerf.measure(objectName, methodNames[key], object[key]);
      }
    }
  },

  /**
   * Use this to wrap methods you want to measure. Zero overhead in production.
   *
   * @param {string} objName
   * @param {string} fnName
   * @param {function} func
   * @return {function}
   */
  measure: function (objName, fnName, func) {
    if ("production" !== 'production') {
      var measuredFunc = null;
      var wrapper = function () {
        if (ReactPerf.enableMeasure) {
          if (!measuredFunc) {
            measuredFunc = ReactPerf.storedMeasure(objName, fnName, func);
          }
          return measuredFunc.apply(this, arguments);
        }
        return func.apply(this, arguments);
      };
      wrapper.displayName = objName + '_' + fnName;
      return wrapper;
    }
    return func;
  },

  injection: {
    /**
     * @param {function} measure
     */
    injectMeasure: function (measure) {
      ReactPerf.storedMeasure = measure;
    }
  }
};

/**
 * Simply passes through the measured function, without measuring it.
 *
 * @param {string} objName
 * @param {string} fnName
 * @param {function} func
 * @return {function}
 */
function _noMeasure(objName, fnName, func) {
  return func;
}

module.exports = ReactPerf;
},{}],128:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactPropTypeLocationNames
 */

'use strict';

var ReactPropTypeLocationNames = {};

if ("production" !== 'production') {
  ReactPropTypeLocationNames = {
    prop: 'prop',
    context: 'context',
    childContext: 'child context'
  };
}

module.exports = ReactPropTypeLocationNames;
},{}],129:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactPropTypeLocations
 */

'use strict';

var keyMirror = require('fbjs/lib/keyMirror');

var ReactPropTypeLocations = keyMirror({
  prop: null,
  context: null,
  childContext: null
});

module.exports = ReactPropTypeLocations;
},{"fbjs/lib/keyMirror":203}],130:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactPropTypes
 */

'use strict';

var ReactElement = require('./ReactElement');
var ReactPropTypeLocationNames = require('./ReactPropTypeLocationNames');

var emptyFunction = require('fbjs/lib/emptyFunction');
var getIteratorFn = require('./getIteratorFn');

/**
 * Collection of methods that allow declaration and validation of props that are
 * supplied to React components. Example usage:
 *
 *   var Props = require('ReactPropTypes');
 *   var MyArticle = React.createClass({
 *     propTypes: {
 *       // An optional string prop named "description".
 *       description: Props.string,
 *
 *       // A required enum prop named "category".
 *       category: Props.oneOf(['News','Photos']).isRequired,
 *
 *       // A prop named "dialog" that requires an instance of Dialog.
 *       dialog: Props.instanceOf(Dialog).isRequired
 *     },
 *     render: function() { ... }
 *   });
 *
 * A more formal specification of how these methods are used:
 *
 *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
 *   decl := ReactPropTypes.{type}(.isRequired)?
 *
 * Each and every declaration produces a function with the same signature. This
 * allows the creation of custom validation functions. For example:
 *
 *  var MyLink = React.createClass({
 *    propTypes: {
 *      // An optional string or URI prop named "href".
 *      href: function(props, propName, componentName) {
 *        var propValue = props[propName];
 *        if (propValue != null && typeof propValue !== 'string' &&
 *            !(propValue instanceof URI)) {
 *          return new Error(
 *            'Expected a string or an URI for ' + propName + ' in ' +
 *            componentName
 *          );
 *        }
 *      }
 *    },
 *    render: function() {...}
 *  });
 *
 * @internal
 */

var ANONYMOUS = '<<anonymous>>';

var ReactPropTypes = {
  array: createPrimitiveTypeChecker('array'),
  bool: createPrimitiveTypeChecker('boolean'),
  func: createPrimitiveTypeChecker('function'),
  number: createPrimitiveTypeChecker('number'),
  object: createPrimitiveTypeChecker('object'),
  string: createPrimitiveTypeChecker('string'),

  any: createAnyTypeChecker(),
  arrayOf: createArrayOfTypeChecker,
  element: createElementTypeChecker(),
  instanceOf: createInstanceTypeChecker,
  node: createNodeChecker(),
  objectOf: createObjectOfTypeChecker,
  oneOf: createEnumTypeChecker,
  oneOfType: createUnionTypeChecker,
  shape: createShapeTypeChecker
};

function createChainableTypeChecker(validate) {
  function checkType(isRequired, props, propName, componentName, location, propFullName) {
    componentName = componentName || ANONYMOUS;
    propFullName = propFullName || propName;
    if (props[propName] == null) {
      var locationName = ReactPropTypeLocationNames[location];
      if (isRequired) {
        return new Error('Required ' + locationName + ' `' + propFullName + '` was not specified in ' + ('`' + componentName + '`.'));
      }
      return null;
    } else {
      return validate(props, propName, componentName, location, propFullName);
    }
  }

  var chainedCheckType = checkType.bind(null, false);
  chainedCheckType.isRequired = checkType.bind(null, true);

  return chainedCheckType;
}

function createPrimitiveTypeChecker(expectedType) {
  function validate(props, propName, componentName, location, propFullName) {
    var propValue = props[propName];
    var propType = getPropType(propValue);
    if (propType !== expectedType) {
      var locationName = ReactPropTypeLocationNames[location];
      // `propValue` being instance of, say, date/regexp, pass the 'object'
      // check, but we can offer a more precise error message here rather than
      // 'of type `object`'.
      var preciseType = getPreciseType(propValue);

      return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createAnyTypeChecker() {
  return createChainableTypeChecker(emptyFunction.thatReturns(null));
}

function createArrayOfTypeChecker(typeChecker) {
  function validate(props, propName, componentName, location, propFullName) {
    var propValue = props[propName];
    if (!Array.isArray(propValue)) {
      var locationName = ReactPropTypeLocationNames[location];
      var propType = getPropType(propValue);
      return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
    }
    for (var i = 0; i < propValue.length; i++) {
      var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']');
      if (error instanceof Error) {
        return error;
      }
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createElementTypeChecker() {
  function validate(props, propName, componentName, location, propFullName) {
    if (!ReactElement.isValidElement(props[propName])) {
      var locationName = ReactPropTypeLocationNames[location];
      return new Error('Invalid ' + locationName + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a single ReactElement.'));
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createInstanceTypeChecker(expectedClass) {
  function validate(props, propName, componentName, location, propFullName) {
    if (!(props[propName] instanceof expectedClass)) {
      var locationName = ReactPropTypeLocationNames[location];
      var expectedClassName = expectedClass.name || ANONYMOUS;
      var actualClassName = getClassName(props[propName]);
      return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createEnumTypeChecker(expectedValues) {
  if (!Array.isArray(expectedValues)) {
    return createChainableTypeChecker(function () {
      return new Error('Invalid argument supplied to oneOf, expected an instance of array.');
    });
  }

  function validate(props, propName, componentName, location, propFullName) {
    var propValue = props[propName];
    for (var i = 0; i < expectedValues.length; i++) {
      if (propValue === expectedValues[i]) {
        return null;
      }
    }

    var locationName = ReactPropTypeLocationNames[location];
    var valuesString = JSON.stringify(expectedValues);
    return new Error('Invalid ' + locationName + ' `' + propFullName + '` of value `' + propValue + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
  }
  return createChainableTypeChecker(validate);
}

function createObjectOfTypeChecker(typeChecker) {
  function validate(props, propName, componentName, location, propFullName) {
    var propValue = props[propName];
    var propType = getPropType(propValue);
    if (propType !== 'object') {
      var locationName = ReactPropTypeLocationNames[location];
      return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
    }
    for (var key in propValue) {
      if (propValue.hasOwnProperty(key)) {
        var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key);
        if (error instanceof Error) {
          return error;
        }
      }
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createUnionTypeChecker(arrayOfTypeCheckers) {
  if (!Array.isArray(arrayOfTypeCheckers)) {
    return createChainableTypeChecker(function () {
      return new Error('Invalid argument supplied to oneOfType, expected an instance of array.');
    });
  }

  function validate(props, propName, componentName, location, propFullName) {
    for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
      var checker = arrayOfTypeCheckers[i];
      if (checker(props, propName, componentName, location, propFullName) == null) {
        return null;
      }
    }

    var locationName = ReactPropTypeLocationNames[location];
    return new Error('Invalid ' + locationName + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
  }
  return createChainableTypeChecker(validate);
}

function createNodeChecker() {
  function validate(props, propName, componentName, location, propFullName) {
    if (!isNode(props[propName])) {
      var locationName = ReactPropTypeLocationNames[location];
      return new Error('Invalid ' + locationName + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createShapeTypeChecker(shapeTypes) {
  function validate(props, propName, componentName, location, propFullName) {
    var propValue = props[propName];
    var propType = getPropType(propValue);
    if (propType !== 'object') {
      var locationName = ReactPropTypeLocationNames[location];
      return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
    }
    for (var key in shapeTypes) {
      var checker = shapeTypes[key];
      if (!checker) {
        continue;
      }
      var error = checker(propValue, key, componentName, location, propFullName + '.' + key);
      if (error) {
        return error;
      }
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function isNode(propValue) {
  switch (typeof propValue) {
    case 'number':
    case 'string':
    case 'undefined':
      return true;
    case 'boolean':
      return !propValue;
    case 'object':
      if (Array.isArray(propValue)) {
        return propValue.every(isNode);
      }
      if (propValue === null || ReactElement.isValidElement(propValue)) {
        return true;
      }

      var iteratorFn = getIteratorFn(propValue);
      if (iteratorFn) {
        var iterator = iteratorFn.call(propValue);
        var step;
        if (iteratorFn !== propValue.entries) {
          while (!(step = iterator.next()).done) {
            if (!isNode(step.value)) {
              return false;
            }
          }
        } else {
          // Iterator will provide entry [k,v] tuples rather than values.
          while (!(step = iterator.next()).done) {
            var entry = step.value;
            if (entry) {
              if (!isNode(entry[1])) {
                return false;
              }
            }
          }
        }
      } else {
        return false;
      }

      return true;
    default:
      return false;
  }
}

// Equivalent of `typeof` but with special handling for array and regexp.
function getPropType(propValue) {
  var propType = typeof propValue;
  if (Array.isArray(propValue)) {
    return 'array';
  }
  if (propValue instanceof RegExp) {
    // Old webkits (at least until Android 4.0) return 'function' rather than
    // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
    // passes PropTypes.object.
    return 'object';
  }
  return propType;
}

// This handles more types than `getPropType`. Only used for error messages.
// See `createPrimitiveTypeChecker`.
function getPreciseType(propValue) {
  var propType = getPropType(propValue);
  if (propType === 'object') {
    if (propValue instanceof Date) {
      return 'date';
    } else if (propValue instanceof RegExp) {
      return 'regexp';
    }
  }
  return propType;
}

// Returns class name of the object, if any.
function getClassName(propValue) {
  if (!propValue.constructor || !propValue.constructor.name) {
    return '<<anonymous>>';
  }
  return propValue.constructor.name;
}

module.exports = ReactPropTypes;
},{"./ReactElement":108,"./ReactPropTypeLocationNames":128,"./getIteratorFn":171,"fbjs/lib/emptyFunction":192}],131:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactReconcileTransaction
 * @typechecks static-only
 */

'use strict';

var CallbackQueue = require('./CallbackQueue');
var PooledClass = require('./PooledClass');
var ReactBrowserEventEmitter = require('./ReactBrowserEventEmitter');
var ReactDOMFeatureFlags = require('./ReactDOMFeatureFlags');
var ReactInputSelection = require('./ReactInputSelection');
var Transaction = require('./Transaction');

var assign = require('./Object.assign');

/**
 * Ensures that, when possible, the selection range (currently selected text
 * input) is not disturbed by performing the transaction.
 */
var SELECTION_RESTORATION = {
  /**
   * @return {Selection} Selection information.
   */
  initialize: ReactInputSelection.getSelectionInformation,
  /**
   * @param {Selection} sel Selection information returned from `initialize`.
   */
  close: ReactInputSelection.restoreSelection
};

/**
 * Suppresses events (blur/focus) that could be inadvertently dispatched due to
 * high level DOM manipulations (like temporarily removing a text input from the
 * DOM).
 */
var EVENT_SUPPRESSION = {
  /**
   * @return {boolean} The enabled status of `ReactBrowserEventEmitter` before
   * the reconciliation.
   */
  initialize: function () {
    var currentlyEnabled = ReactBrowserEventEmitter.isEnabled();
    ReactBrowserEventEmitter.setEnabled(false);
    return currentlyEnabled;
  },

  /**
   * @param {boolean} previouslyEnabled Enabled status of
   *   `ReactBrowserEventEmitter` before the reconciliation occurred. `close`
   *   restores the previous value.
   */
  close: function (previouslyEnabled) {
    ReactBrowserEventEmitter.setEnabled(previouslyEnabled);
  }
};

/**
 * Provides a queue for collecting `componentDidMount` and
 * `componentDidUpdate` callbacks during the the transaction.
 */
var ON_DOM_READY_QUEUEING = {
  /**
   * Initializes the internal `onDOMReady` queue.
   */
  initialize: function () {
    this.reactMountReady.reset();
  },

  /**
   * After DOM is flushed, invoke all registered `onDOMReady` callbacks.
   */
  close: function () {
    this.reactMountReady.notifyAll();
  }
};

/**
 * Executed within the scope of the `Transaction` instance. Consider these as
 * being member methods, but with an implied ordering while being isolated from
 * each other.
 */
var TRANSACTION_WRAPPERS = [SELECTION_RESTORATION, EVENT_SUPPRESSION, ON_DOM_READY_QUEUEING];

/**
 * Currently:
 * - The order that these are listed in the transaction is critical:
 * - Suppresses events.
 * - Restores selection range.
 *
 * Future:
 * - Restore document/overflow scroll positions that were unintentionally
 *   modified via DOM insertions above the top viewport boundary.
 * - Implement/integrate with customized constraint based layout system and keep
 *   track of which dimensions must be remeasured.
 *
 * @class ReactReconcileTransaction
 */
function ReactReconcileTransaction(forceHTML) {
  this.reinitializeTransaction();
  // Only server-side rendering really needs this option (see
  // `ReactServerRendering`), but server-side uses
  // `ReactServerRenderingTransaction` instead. This option is here so that it's
  // accessible and defaults to false when `ReactDOMComponent` and
  // `ReactTextComponent` checks it in `mountComponent`.`
  this.renderToStaticMarkup = false;
  this.reactMountReady = CallbackQueue.getPooled(null);
  this.useCreateElement = !forceHTML && ReactDOMFeatureFlags.useCreateElement;
}

var Mixin = {
  /**
   * @see Transaction
   * @abstract
   * @final
   * @return {array<object>} List of operation wrap procedures.
   *   TODO: convert to array<TransactionWrapper>
   */
  getTransactionWrappers: function () {
    return TRANSACTION_WRAPPERS;
  },

  /**
   * @return {object} The queue to collect `onDOMReady` callbacks with.
   */
  getReactMountReady: function () {
    return this.reactMountReady;
  },

  /**
   * `PooledClass` looks for this, and will invoke this before allowing this
   * instance to be reused.
   */
  destructor: function () {
    CallbackQueue.release(this.reactMountReady);
    this.reactMountReady = null;
  }
};

assign(ReactReconcileTransaction.prototype, Transaction.Mixin, Mixin);

PooledClass.addPoolingTo(ReactReconcileTransaction);

module.exports = ReactReconcileTransaction;
},{"./CallbackQueue":61,"./Object.assign":78,"./PooledClass":79,"./ReactBrowserEventEmitter":82,"./ReactDOMFeatureFlags":95,"./ReactInputSelection":116,"./Transaction":156}],132:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactReconciler
 */

'use strict';

var ReactRef = require('./ReactRef');

/**
 * Helper to call ReactRef.attachRefs with this composite component, split out
 * to avoid allocations in the transaction mount-ready queue.
 */
function attachRefs() {
  ReactRef.attachRefs(this, this._currentElement);
}

var ReactReconciler = {

  /**
   * Initializes the component, renders markup, and registers event listeners.
   *
   * @param {ReactComponent} internalInstance
   * @param {string} rootID DOM ID of the root node.
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @return {?string} Rendered markup to be inserted into the DOM.
   * @final
   * @internal
   */
  mountComponent: function (internalInstance, rootID, transaction, context) {
    var markup = internalInstance.mountComponent(rootID, transaction, context);
    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {
      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
    }
    return markup;
  },

  /**
   * Releases any resources allocated by `mountComponent`.
   *
   * @final
   * @internal
   */
  unmountComponent: function (internalInstance) {
    ReactRef.detachRefs(internalInstance, internalInstance._currentElement);
    internalInstance.unmountComponent();
  },

  /**
   * Update a component using a new element.
   *
   * @param {ReactComponent} internalInstance
   * @param {ReactElement} nextElement
   * @param {ReactReconcileTransaction} transaction
   * @param {object} context
   * @internal
   */
  receiveComponent: function (internalInstance, nextElement, transaction, context) {
    var prevElement = internalInstance._currentElement;

    if (nextElement === prevElement && context === internalInstance._context) {
      // Since elements are immutable after the owner is rendered,
      // we can do a cheap identity compare here to determine if this is a
      // superfluous reconcile. It's possible for state to be mutable but such
      // change should trigger an update of the owner which would recreate
      // the element. We explicitly check for the existence of an owner since
      // it's possible for an element created outside a composite to be
      // deeply mutated and reused.

      // TODO: Bailing out early is just a perf optimization right?
      // TODO: Removing the return statement should affect correctness?
      return;
    }

    var refsChanged = ReactRef.shouldUpdateRefs(prevElement, nextElement);

    if (refsChanged) {
      ReactRef.detachRefs(internalInstance, prevElement);
    }

    internalInstance.receiveComponent(nextElement, transaction, context);

    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {
      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
    }
  },

  /**
   * Flush any dirty changes in a component.
   *
   * @param {ReactComponent} internalInstance
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  performUpdateIfNecessary: function (internalInstance, transaction) {
    internalInstance.performUpdateIfNecessary(transaction);
  }

};

module.exports = ReactReconciler;
},{"./ReactRef":133}],133:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactRef
 */

'use strict';

var ReactOwner = require('./ReactOwner');

var ReactRef = {};

function attachRef(ref, component, owner) {
  if (typeof ref === 'function') {
    ref(component.getPublicInstance());
  } else {
    // Legacy ref
    ReactOwner.addComponentAsRefTo(component, ref, owner);
  }
}

function detachRef(ref, component, owner) {
  if (typeof ref === 'function') {
    ref(null);
  } else {
    // Legacy ref
    ReactOwner.removeComponentAsRefFrom(component, ref, owner);
  }
}

ReactRef.attachRefs = function (instance, element) {
  if (element === null || element === false) {
    return;
  }
  var ref = element.ref;
  if (ref != null) {
    attachRef(ref, instance, element._owner);
  }
};

ReactRef.shouldUpdateRefs = function (prevElement, nextElement) {
  // If either the owner or a `ref` has changed, make sure the newest owner
  // has stored a reference to `this`, and the previous owner (if different)
  // has forgotten the reference to `this`. We use the element instead
  // of the public this.props because the post processing cannot determine
  // a ref. The ref conceptually lives on the element.

  // TODO: Should this even be possible? The owner cannot change because
  // it's forbidden by shouldUpdateReactComponent. The ref can change
  // if you swap the keys of but not the refs. Reconsider where this check
  // is made. It probably belongs where the key checking and
  // instantiateReactComponent is done.

  var prevEmpty = prevElement === null || prevElement === false;
  var nextEmpty = nextElement === null || nextElement === false;

  return(
    // This has a few false positives w/r/t empty components.
    prevEmpty || nextEmpty || nextElement._owner !== prevElement._owner || nextElement.ref !== prevElement.ref
  );
};

ReactRef.detachRefs = function (instance, element) {
  if (element === null || element === false) {
    return;
  }
  var ref = element.ref;
  if (ref != null) {
    detachRef(ref, instance, element._owner);
  }
};

module.exports = ReactRef;
},{"./ReactOwner":126}],134:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactRootIndex
 * @typechecks
 */

'use strict';

var ReactRootIndexInjection = {
  /**
   * @param {function} _createReactRootIndex
   */
  injectCreateReactRootIndex: function (_createReactRootIndex) {
    ReactRootIndex.createReactRootIndex = _createReactRootIndex;
  }
};

var ReactRootIndex = {
  createReactRootIndex: null,
  injection: ReactRootIndexInjection
};

module.exports = ReactRootIndex;
},{}],135:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactServerBatchingStrategy
 * @typechecks
 */

'use strict';

var ReactServerBatchingStrategy = {
  isBatchingUpdates: false,
  batchedUpdates: function (callback) {
    // Don't do anything here. During the server rendering we don't want to
    // schedule any updates. We will simply ignore them.
  }
};

module.exports = ReactServerBatchingStrategy;
},{}],136:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @typechecks static-only
 * @providesModule ReactServerRendering
 */
'use strict';

var ReactDefaultBatchingStrategy = require('./ReactDefaultBatchingStrategy');
var ReactElement = require('./ReactElement');
var ReactInstanceHandles = require('./ReactInstanceHandles');
var ReactMarkupChecksum = require('./ReactMarkupChecksum');
var ReactServerBatchingStrategy = require('./ReactServerBatchingStrategy');
var ReactServerRenderingTransaction = require('./ReactServerRenderingTransaction');
var ReactUpdates = require('./ReactUpdates');

var emptyObject = require('fbjs/lib/emptyObject');
var instantiateReactComponent = require('./instantiateReactComponent');
var invariant = require('fbjs/lib/invariant');

/**
 * @param {ReactElement} element
 * @return {string} the HTML markup
 */
function renderToString(element) {
  !ReactElement.isValidElement(element) ? "production" !== 'production' ? invariant(false, 'renderToString(): You must pass a valid ReactElement.') : invariant(false) : undefined;

  var transaction;
  try {
    ReactUpdates.injection.injectBatchingStrategy(ReactServerBatchingStrategy);

    var id = ReactInstanceHandles.createReactRootID();
    transaction = ReactServerRenderingTransaction.getPooled(false);

    return transaction.perform(function () {
      var componentInstance = instantiateReactComponent(element, null);
      var markup = componentInstance.mountComponent(id, transaction, emptyObject);
      return ReactMarkupChecksum.addChecksumToMarkup(markup);
    }, null);
  } finally {
    ReactServerRenderingTransaction.release(transaction);
    // Revert to the DOM batching strategy since these two renderers
    // currently share these stateful modules.
    ReactUpdates.injection.injectBatchingStrategy(ReactDefaultBatchingStrategy);
  }
}

/**
 * @param {ReactElement} element
 * @return {string} the HTML markup, without the extra React ID and checksum
 * (for generating static pages)
 */
function renderToStaticMarkup(element) {
  !ReactElement.isValidElement(element) ? "production" !== 'production' ? invariant(false, 'renderToStaticMarkup(): You must pass a valid ReactElement.') : invariant(false) : undefined;

  var transaction;
  try {
    ReactUpdates.injection.injectBatchingStrategy(ReactServerBatchingStrategy);

    var id = ReactInstanceHandles.createReactRootID();
    transaction = ReactServerRenderingTransaction.getPooled(true);

    return transaction.perform(function () {
      var componentInstance = instantiateReactComponent(element, null);
      return componentInstance.mountComponent(id, transaction, emptyObject);
    }, null);
  } finally {
    ReactServerRenderingTransaction.release(transaction);
    // Revert to the DOM batching strategy since these two renderers
    // currently share these stateful modules.
    ReactUpdates.injection.injectBatchingStrategy(ReactDefaultBatchingStrategy);
  }
}

module.exports = {
  renderToString: renderToString,
  renderToStaticMarkup: renderToStaticMarkup
};
},{"./ReactDefaultBatchingStrategy":104,"./ReactElement":108,"./ReactInstanceHandles":117,"./ReactMarkupChecksum":120,"./ReactServerBatchingStrategy":135,"./ReactServerRenderingTransaction":137,"./ReactUpdates":139,"./instantiateReactComponent":174,"fbjs/lib/emptyObject":193,"fbjs/lib/invariant":200}],137:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactServerRenderingTransaction
 * @typechecks
 */

'use strict';

var PooledClass = require('./PooledClass');
var CallbackQueue = require('./CallbackQueue');
var Transaction = require('./Transaction');

var assign = require('./Object.assign');
var emptyFunction = require('fbjs/lib/emptyFunction');

/**
 * Provides a `CallbackQueue` queue for collecting `onDOMReady` callbacks
 * during the performing of the transaction.
 */
var ON_DOM_READY_QUEUEING = {
  /**
   * Initializes the internal `onDOMReady` queue.
   */
  initialize: function () {
    this.reactMountReady.reset();
  },

  close: emptyFunction
};

/**
 * Executed within the scope of the `Transaction` instance. Consider these as
 * being member methods, but with an implied ordering while being isolated from
 * each other.
 */
var TRANSACTION_WRAPPERS = [ON_DOM_READY_QUEUEING];

/**
 * @class ReactServerRenderingTransaction
 * @param {boolean} renderToStaticMarkup
 */
function ReactServerRenderingTransaction(renderToStaticMarkup) {
  this.reinitializeTransaction();
  this.renderToStaticMarkup = renderToStaticMarkup;
  this.reactMountReady = CallbackQueue.getPooled(null);
  this.useCreateElement = false;
}

var Mixin = {
  /**
   * @see Transaction
   * @abstract
   * @final
   * @return {array} Empty list of operation wrap procedures.
   */
  getTransactionWrappers: function () {
    return TRANSACTION_WRAPPERS;
  },

  /**
   * @return {object} The queue to collect `onDOMReady` callbacks with.
   */
  getReactMountReady: function () {
    return this.reactMountReady;
  },

  /**
   * `PooledClass` looks for this, and will invoke this before allowing this
   * instance to be reused.
   */
  destructor: function () {
    CallbackQueue.release(this.reactMountReady);
    this.reactMountReady = null;
  }
};

assign(ReactServerRenderingTransaction.prototype, Transaction.Mixin, Mixin);

PooledClass.addPoolingTo(ReactServerRenderingTransaction);

module.exports = ReactServerRenderingTransaction;
},{"./CallbackQueue":61,"./Object.assign":78,"./PooledClass":79,"./Transaction":156,"fbjs/lib/emptyFunction":192}],138:[function(require,module,exports){
/**
 * Copyright 2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactUpdateQueue
 */

'use strict';

var ReactCurrentOwner = require('./ReactCurrentOwner');
var ReactElement = require('./ReactElement');
var ReactInstanceMap = require('./ReactInstanceMap');
var ReactUpdates = require('./ReactUpdates');

var assign = require('./Object.assign');
var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

function enqueueUpdate(internalInstance) {
  ReactUpdates.enqueueUpdate(internalInstance);
}

function getInternalInstanceReadyForUpdate(publicInstance, callerName) {
  var internalInstance = ReactInstanceMap.get(publicInstance);
  if (!internalInstance) {
    if ("production" !== 'production') {
      // Only warn when we have a callerName. Otherwise we should be silent.
      // We're probably calling from enqueueCallback. We don't want to warn
      // there because we already warned for the corresponding lifecycle method.
      "production" !== 'production' ? warning(!callerName, '%s(...): Can only update a mounted or mounting component. ' + 'This usually means you called %s() on an unmounted component. ' + 'This is a no-op. Please check the code for the %s component.', callerName, callerName, publicInstance.constructor.displayName) : undefined;
    }
    return null;
  }

  if ("production" !== 'production') {
    "production" !== 'production' ? warning(ReactCurrentOwner.current == null, '%s(...): Cannot update during an existing state transition ' + '(such as within `render`). Render methods should be a pure function ' + 'of props and state.', callerName) : undefined;
  }

  return internalInstance;
}

/**
 * ReactUpdateQueue allows for state updates to be scheduled into a later
 * reconciliation step.
 */
var ReactUpdateQueue = {

  /**
   * Checks whether or not this composite component is mounted.
   * @param {ReactClass} publicInstance The instance we want to test.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  isMounted: function (publicInstance) {
    if ("production" !== 'production') {
      var owner = ReactCurrentOwner.current;
      if (owner !== null) {
        "production" !== 'production' ? warning(owner._warnedAboutRefsInRender, '%s is accessing isMounted inside its render() function. ' + 'render() should be a pure function of props and state. It should ' + 'never access something that requires stale data from the previous ' + 'render, such as refs. Move this logic to componentDidMount and ' + 'componentDidUpdate instead.', owner.getName() || 'A component') : undefined;
        owner._warnedAboutRefsInRender = true;
      }
    }
    var internalInstance = ReactInstanceMap.get(publicInstance);
    if (internalInstance) {
      // During componentWillMount and render this will still be null but after
      // that will always render to something. At least for now. So we can use
      // this hack.
      return !!internalInstance._renderedComponent;
    } else {
      return false;
    }
  },

  /**
   * Enqueue a callback that will be executed after all the pending updates
   * have processed.
   *
   * @param {ReactClass} publicInstance The instance to use as `this` context.
   * @param {?function} callback Called after state is updated.
   * @internal
   */
  enqueueCallback: function (publicInstance, callback) {
    !(typeof callback === 'function') ? "production" !== 'production' ? invariant(false, 'enqueueCallback(...): You called `setProps`, `replaceProps`, ' + '`setState`, `replaceState`, or `forceUpdate` with a callback that ' + 'isn\'t callable.') : invariant(false) : undefined;
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance);

    // Previously we would throw an error if we didn't have an internal
    // instance. Since we want to make it a no-op instead, we mirror the same
    // behavior we have in other enqueue* methods.
    // We also need to ignore callbacks in componentWillMount. See
    // enqueueUpdates.
    if (!internalInstance) {
      return null;
    }

    if (internalInstance._pendingCallbacks) {
      internalInstance._pendingCallbacks.push(callback);
    } else {
      internalInstance._pendingCallbacks = [callback];
    }
    // TODO: The callback here is ignored when setState is called from
    // componentWillMount. Either fix it or disallow doing so completely in
    // favor of getInitialState. Alternatively, we can disallow
    // componentWillMount during server-side rendering.
    enqueueUpdate(internalInstance);
  },

  enqueueCallbackInternal: function (internalInstance, callback) {
    !(typeof callback === 'function') ? "production" !== 'production' ? invariant(false, 'enqueueCallback(...): You called `setProps`, `replaceProps`, ' + '`setState`, `replaceState`, or `forceUpdate` with a callback that ' + 'isn\'t callable.') : invariant(false) : undefined;
    if (internalInstance._pendingCallbacks) {
      internalInstance._pendingCallbacks.push(callback);
    } else {
      internalInstance._pendingCallbacks = [callback];
    }
    enqueueUpdate(internalInstance);
  },

  /**
   * Forces an update. This should only be invoked when it is known with
   * certainty that we are **not** in a DOM transaction.
   *
   * You may want to call this when you know that some deeper aspect of the
   * component's state has changed but `setState` was not called.
   *
   * This will not invoke `shouldComponentUpdate`, but it will invoke
   * `componentWillUpdate` and `componentDidUpdate`.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @internal
   */
  enqueueForceUpdate: function (publicInstance) {
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'forceUpdate');

    if (!internalInstance) {
      return;
    }

    internalInstance._pendingForceUpdate = true;

    enqueueUpdate(internalInstance);
  },

  /**
   * Replaces all of the state. Always use this or `setState` to mutate state.
   * You should treat `this.state` as immutable.
   *
   * There is no guarantee that `this.state` will be immediately updated, so
   * accessing `this.state` after calling this method may return the old value.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} completeState Next state.
   * @internal
   */
  enqueueReplaceState: function (publicInstance, completeState) {
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'replaceState');

    if (!internalInstance) {
      return;
    }

    internalInstance._pendingStateQueue = [completeState];
    internalInstance._pendingReplaceState = true;

    enqueueUpdate(internalInstance);
  },

  /**
   * Sets a subset of the state. This only exists because _pendingState is
   * internal. This provides a merging strategy that is not available to deep
   * properties which is confusing. TODO: Expose pendingState or don't use it
   * during the merge.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} partialState Next partial state to be merged with state.
   * @internal
   */
  enqueueSetState: function (publicInstance, partialState) {
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'setState');

    if (!internalInstance) {
      return;
    }

    var queue = internalInstance._pendingStateQueue || (internalInstance._pendingStateQueue = []);
    queue.push(partialState);

    enqueueUpdate(internalInstance);
  },

  /**
   * Sets a subset of the props.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} partialProps Subset of the next props.
   * @internal
   */
  enqueueSetProps: function (publicInstance, partialProps) {
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'setProps');
    if (!internalInstance) {
      return;
    }
    ReactUpdateQueue.enqueueSetPropsInternal(internalInstance, partialProps);
  },

  enqueueSetPropsInternal: function (internalInstance, partialProps) {
    var topLevelWrapper = internalInstance._topLevelWrapper;
    !topLevelWrapper ? "production" !== 'production' ? invariant(false, 'setProps(...): You called `setProps` on a ' + 'component with a parent. This is an anti-pattern since props will ' + 'get reactively updated when rendered. Instead, change the owner\'s ' + '`render` method to pass the correct value as props to the component ' + 'where it is created.') : invariant(false) : undefined;

    // Merge with the pending element if it exists, otherwise with existing
    // element props.
    var wrapElement = topLevelWrapper._pendingElement || topLevelWrapper._currentElement;
    var element = wrapElement.props;
    var props = assign({}, element.props, partialProps);
    topLevelWrapper._pendingElement = ReactElement.cloneAndReplaceProps(wrapElement, ReactElement.cloneAndReplaceProps(element, props));

    enqueueUpdate(topLevelWrapper);
  },

  /**
   * Replaces all of the props.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} props New props.
   * @internal
   */
  enqueueReplaceProps: function (publicInstance, props) {
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'replaceProps');
    if (!internalInstance) {
      return;
    }
    ReactUpdateQueue.enqueueReplacePropsInternal(internalInstance, props);
  },

  enqueueReplacePropsInternal: function (internalInstance, props) {
    var topLevelWrapper = internalInstance._topLevelWrapper;
    !topLevelWrapper ? "production" !== 'production' ? invariant(false, 'replaceProps(...): You called `replaceProps` on a ' + 'component with a parent. This is an anti-pattern since props will ' + 'get reactively updated when rendered. Instead, change the owner\'s ' + '`render` method to pass the correct value as props to the component ' + 'where it is created.') : invariant(false) : undefined;

    // Merge with the pending element if it exists, otherwise with existing
    // element props.
    var wrapElement = topLevelWrapper._pendingElement || topLevelWrapper._currentElement;
    var element = wrapElement.props;
    topLevelWrapper._pendingElement = ReactElement.cloneAndReplaceProps(wrapElement, ReactElement.cloneAndReplaceProps(element, props));

    enqueueUpdate(topLevelWrapper);
  },

  enqueueElementInternal: function (internalInstance, newElement) {
    internalInstance._pendingElement = newElement;
    enqueueUpdate(internalInstance);
  }

};

module.exports = ReactUpdateQueue;
},{"./Object.assign":78,"./ReactCurrentOwner":90,"./ReactElement":108,"./ReactInstanceMap":118,"./ReactUpdates":139,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],139:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactUpdates
 */

'use strict';

var CallbackQueue = require('./CallbackQueue');
var PooledClass = require('./PooledClass');
var ReactPerf = require('./ReactPerf');
var ReactReconciler = require('./ReactReconciler');
var Transaction = require('./Transaction');

var assign = require('./Object.assign');
var invariant = require('fbjs/lib/invariant');

var dirtyComponents = [];
var asapCallbackQueue = CallbackQueue.getPooled();
var asapEnqueued = false;

var batchingStrategy = null;

function ensureInjected() {
  !(ReactUpdates.ReactReconcileTransaction && batchingStrategy) ? "production" !== 'production' ? invariant(false, 'ReactUpdates: must inject a reconcile transaction class and batching ' + 'strategy') : invariant(false) : undefined;
}

var NESTED_UPDATES = {
  initialize: function () {
    this.dirtyComponentsLength = dirtyComponents.length;
  },
  close: function () {
    if (this.dirtyComponentsLength !== dirtyComponents.length) {
      // Additional updates were enqueued by componentDidUpdate handlers or
      // similar; before our own UPDATE_QUEUEING wrapper closes, we want to run
      // these new updates so that if A's componentDidUpdate calls setState on
      // B, B will update before the callback A's updater provided when calling
      // setState.
      dirtyComponents.splice(0, this.dirtyComponentsLength);
      flushBatchedUpdates();
    } else {
      dirtyComponents.length = 0;
    }
  }
};

var UPDATE_QUEUEING = {
  initialize: function () {
    this.callbackQueue.reset();
  },
  close: function () {
    this.callbackQueue.notifyAll();
  }
};

var TRANSACTION_WRAPPERS = [NESTED_UPDATES, UPDATE_QUEUEING];

function ReactUpdatesFlushTransaction() {
  this.reinitializeTransaction();
  this.dirtyComponentsLength = null;
  this.callbackQueue = CallbackQueue.getPooled();
  this.reconcileTransaction = ReactUpdates.ReactReconcileTransaction.getPooled( /* forceHTML */false);
}

assign(ReactUpdatesFlushTransaction.prototype, Transaction.Mixin, {
  getTransactionWrappers: function () {
    return TRANSACTION_WRAPPERS;
  },

  destructor: function () {
    this.dirtyComponentsLength = null;
    CallbackQueue.release(this.callbackQueue);
    this.callbackQueue = null;
    ReactUpdates.ReactReconcileTransaction.release(this.reconcileTransaction);
    this.reconcileTransaction = null;
  },

  perform: function (method, scope, a) {
    // Essentially calls `this.reconcileTransaction.perform(method, scope, a)`
    // with this transaction's wrappers around it.
    return Transaction.Mixin.perform.call(this, this.reconcileTransaction.perform, this.reconcileTransaction, method, scope, a);
  }
});

PooledClass.addPoolingTo(ReactUpdatesFlushTransaction);

function batchedUpdates(callback, a, b, c, d, e) {
  ensureInjected();
  batchingStrategy.batchedUpdates(callback, a, b, c, d, e);
}

/**
 * Array comparator for ReactComponents by mount ordering.
 *
 * @param {ReactComponent} c1 first component you're comparing
 * @param {ReactComponent} c2 second component you're comparing
 * @return {number} Return value usable by Array.prototype.sort().
 */
function mountOrderComparator(c1, c2) {
  return c1._mountOrder - c2._mountOrder;
}

function runBatchedUpdates(transaction) {
  var len = transaction.dirtyComponentsLength;
  !(len === dirtyComponents.length) ? "production" !== 'production' ? invariant(false, 'Expected flush transaction\'s stored dirty-components length (%s) to ' + 'match dirty-components array length (%s).', len, dirtyComponents.length) : invariant(false) : undefined;

  // Since reconciling a component higher in the owner hierarchy usually (not
  // always -- see shouldComponentUpdate()) will reconcile children, reconcile
  // them before their children by sorting the array.
  dirtyComponents.sort(mountOrderComparator);

  for (var i = 0; i < len; i++) {
    // If a component is unmounted before pending changes apply, it will still
    // be here, but we assume that it has cleared its _pendingCallbacks and
    // that performUpdateIfNecessary is a noop.
    var component = dirtyComponents[i];

    // If performUpdateIfNecessary happens to enqueue any new updates, we
    // shouldn't execute the callbacks until the next render happens, so
    // stash the callbacks first
    var callbacks = component._pendingCallbacks;
    component._pendingCallbacks = null;

    ReactReconciler.performUpdateIfNecessary(component, transaction.reconcileTransaction);

    if (callbacks) {
      for (var j = 0; j < callbacks.length; j++) {
        transaction.callbackQueue.enqueue(callbacks[j], component.getPublicInstance());
      }
    }
  }
}

var flushBatchedUpdates = function () {
  // ReactUpdatesFlushTransaction's wrappers will clear the dirtyComponents
  // array and perform any updates enqueued by mount-ready handlers (i.e.,
  // componentDidUpdate) but we need to check here too in order to catch
  // updates enqueued by setState callbacks and asap calls.
  while (dirtyComponents.length || asapEnqueued) {
    if (dirtyComponents.length) {
      var transaction = ReactUpdatesFlushTransaction.getPooled();
      transaction.perform(runBatchedUpdates, null, transaction);
      ReactUpdatesFlushTransaction.release(transaction);
    }

    if (asapEnqueued) {
      asapEnqueued = false;
      var queue = asapCallbackQueue;
      asapCallbackQueue = CallbackQueue.getPooled();
      queue.notifyAll();
      CallbackQueue.release(queue);
    }
  }
};
flushBatchedUpdates = ReactPerf.measure('ReactUpdates', 'flushBatchedUpdates', flushBatchedUpdates);

/**
 * Mark a component as needing a rerender, adding an optional callback to a
 * list of functions which will be executed once the rerender occurs.
 */
function enqueueUpdate(component) {
  ensureInjected();

  // Various parts of our code (such as ReactCompositeComponent's
  // _renderValidatedComponent) assume that calls to render aren't nested;
  // verify that that's the case. (This is called by each top-level update
  // function, like setProps, setState, forceUpdate, etc.; creation and
  // destruction of top-level components is guarded in ReactMount.)

  if (!batchingStrategy.isBatchingUpdates) {
    batchingStrategy.batchedUpdates(enqueueUpdate, component);
    return;
  }

  dirtyComponents.push(component);
}

/**
 * Enqueue a callback to be run at the end of the current batching cycle. Throws
 * if no updates are currently being performed.
 */
function asap(callback, context) {
  !batchingStrategy.isBatchingUpdates ? "production" !== 'production' ? invariant(false, 'ReactUpdates.asap: Can\'t enqueue an asap callback in a context where' + 'updates are not being batched.') : invariant(false) : undefined;
  asapCallbackQueue.enqueue(callback, context);
  asapEnqueued = true;
}

var ReactUpdatesInjection = {
  injectReconcileTransaction: function (ReconcileTransaction) {
    !ReconcileTransaction ? "production" !== 'production' ? invariant(false, 'ReactUpdates: must provide a reconcile transaction class') : invariant(false) : undefined;
    ReactUpdates.ReactReconcileTransaction = ReconcileTransaction;
  },

  injectBatchingStrategy: function (_batchingStrategy) {
    !_batchingStrategy ? "production" !== 'production' ? invariant(false, 'ReactUpdates: must provide a batching strategy') : invariant(false) : undefined;
    !(typeof _batchingStrategy.batchedUpdates === 'function') ? "production" !== 'production' ? invariant(false, 'ReactUpdates: must provide a batchedUpdates() function') : invariant(false) : undefined;
    !(typeof _batchingStrategy.isBatchingUpdates === 'boolean') ? "production" !== 'production' ? invariant(false, 'ReactUpdates: must provide an isBatchingUpdates boolean attribute') : invariant(false) : undefined;
    batchingStrategy = _batchingStrategy;
  }
};

var ReactUpdates = {
  /**
   * React references `ReactReconcileTransaction` using this property in order
   * to allow dependency injection.
   *
   * @internal
   */
  ReactReconcileTransaction: null,

  batchedUpdates: batchedUpdates,
  enqueueUpdate: enqueueUpdate,
  flushBatchedUpdates: flushBatchedUpdates,
  injection: ReactUpdatesInjection,
  asap: asap
};

module.exports = ReactUpdates;
},{"./CallbackQueue":61,"./Object.assign":78,"./PooledClass":79,"./ReactPerf":127,"./ReactReconciler":132,"./Transaction":156,"fbjs/lib/invariant":200}],140:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactVersion
 */

'use strict';

module.exports = '0.14.7';
},{}],141:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SVGDOMPropertyConfig
 */

'use strict';

var DOMProperty = require('./DOMProperty');

var MUST_USE_ATTRIBUTE = DOMProperty.injection.MUST_USE_ATTRIBUTE;

var NS = {
  xlink: 'http://www.w3.org/1999/xlink',
  xml: 'http://www.w3.org/XML/1998/namespace'
};

var SVGDOMPropertyConfig = {
  Properties: {
    clipPath: MUST_USE_ATTRIBUTE,
    cx: MUST_USE_ATTRIBUTE,
    cy: MUST_USE_ATTRIBUTE,
    d: MUST_USE_ATTRIBUTE,
    dx: MUST_USE_ATTRIBUTE,
    dy: MUST_USE_ATTRIBUTE,
    fill: MUST_USE_ATTRIBUTE,
    fillOpacity: MUST_USE_ATTRIBUTE,
    fontFamily: MUST_USE_ATTRIBUTE,
    fontSize: MUST_USE_ATTRIBUTE,
    fx: MUST_USE_ATTRIBUTE,
    fy: MUST_USE_ATTRIBUTE,
    gradientTransform: MUST_USE_ATTRIBUTE,
    gradientUnits: MUST_USE_ATTRIBUTE,
    markerEnd: MUST_USE_ATTRIBUTE,
    markerMid: MUST_USE_ATTRIBUTE,
    markerStart: MUST_USE_ATTRIBUTE,
    offset: MUST_USE_ATTRIBUTE,
    opacity: MUST_USE_ATTRIBUTE,
    patternContentUnits: MUST_USE_ATTRIBUTE,
    patternUnits: MUST_USE_ATTRIBUTE,
    points: MUST_USE_ATTRIBUTE,
    preserveAspectRatio: MUST_USE_ATTRIBUTE,
    r: MUST_USE_ATTRIBUTE,
    rx: MUST_USE_ATTRIBUTE,
    ry: MUST_USE_ATTRIBUTE,
    spreadMethod: MUST_USE_ATTRIBUTE,
    stopColor: MUST_USE_ATTRIBUTE,
    stopOpacity: MUST_USE_ATTRIBUTE,
    stroke: MUST_USE_ATTRIBUTE,
    strokeDasharray: MUST_USE_ATTRIBUTE,
    strokeLinecap: MUST_USE_ATTRIBUTE,
    strokeOpacity: MUST_USE_ATTRIBUTE,
    strokeWidth: MUST_USE_ATTRIBUTE,
    textAnchor: MUST_USE_ATTRIBUTE,
    transform: MUST_USE_ATTRIBUTE,
    version: MUST_USE_ATTRIBUTE,
    viewBox: MUST_USE_ATTRIBUTE,
    x1: MUST_USE_ATTRIBUTE,
    x2: MUST_USE_ATTRIBUTE,
    x: MUST_USE_ATTRIBUTE,
    xlinkActuate: MUST_USE_ATTRIBUTE,
    xlinkArcrole: MUST_USE_ATTRIBUTE,
    xlinkHref: MUST_USE_ATTRIBUTE,
    xlinkRole: MUST_USE_ATTRIBUTE,
    xlinkShow: MUST_USE_ATTRIBUTE,
    xlinkTitle: MUST_USE_ATTRIBUTE,
    xlinkType: MUST_USE_ATTRIBUTE,
    xmlBase: MUST_USE_ATTRIBUTE,
    xmlLang: MUST_USE_ATTRIBUTE,
    xmlSpace: MUST_USE_ATTRIBUTE,
    y1: MUST_USE_ATTRIBUTE,
    y2: MUST_USE_ATTRIBUTE,
    y: MUST_USE_ATTRIBUTE
  },
  DOMAttributeNamespaces: {
    xlinkActuate: NS.xlink,
    xlinkArcrole: NS.xlink,
    xlinkHref: NS.xlink,
    xlinkRole: NS.xlink,
    xlinkShow: NS.xlink,
    xlinkTitle: NS.xlink,
    xlinkType: NS.xlink,
    xmlBase: NS.xml,
    xmlLang: NS.xml,
    xmlSpace: NS.xml
  },
  DOMAttributeNames: {
    clipPath: 'clip-path',
    fillOpacity: 'fill-opacity',
    fontFamily: 'font-family',
    fontSize: 'font-size',
    gradientTransform: 'gradientTransform',
    gradientUnits: 'gradientUnits',
    markerEnd: 'marker-end',
    markerMid: 'marker-mid',
    markerStart: 'marker-start',
    patternContentUnits: 'patternContentUnits',
    patternUnits: 'patternUnits',
    preserveAspectRatio: 'preserveAspectRatio',
    spreadMethod: 'spreadMethod',
    stopColor: 'stop-color',
    stopOpacity: 'stop-opacity',
    strokeDasharray: 'stroke-dasharray',
    strokeLinecap: 'stroke-linecap',
    strokeOpacity: 'stroke-opacity',
    strokeWidth: 'stroke-width',
    textAnchor: 'text-anchor',
    viewBox: 'viewBox',
    xlinkActuate: 'xlink:actuate',
    xlinkArcrole: 'xlink:arcrole',
    xlinkHref: 'xlink:href',
    xlinkRole: 'xlink:role',
    xlinkShow: 'xlink:show',
    xlinkTitle: 'xlink:title',
    xlinkType: 'xlink:type',
    xmlBase: 'xml:base',
    xmlLang: 'xml:lang',
    xmlSpace: 'xml:space'
  }
};

module.exports = SVGDOMPropertyConfig;
},{"./DOMProperty":65}],142:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SelectEventPlugin
 */

'use strict';

var EventConstants = require('./EventConstants');
var EventPropagators = require('./EventPropagators');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');
var ReactInputSelection = require('./ReactInputSelection');
var SyntheticEvent = require('./SyntheticEvent');

var getActiveElement = require('fbjs/lib/getActiveElement');
var isTextInputElement = require('./isTextInputElement');
var keyOf = require('fbjs/lib/keyOf');
var shallowEqual = require('fbjs/lib/shallowEqual');

var topLevelTypes = EventConstants.topLevelTypes;

var skipSelectionChangeEvent = ExecutionEnvironment.canUseDOM && 'documentMode' in document && document.documentMode <= 11;

var eventTypes = {
  select: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onSelect: null }),
      captured: keyOf({ onSelectCapture: null })
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topContextMenu, topLevelTypes.topFocus, topLevelTypes.topKeyDown, topLevelTypes.topMouseDown, topLevelTypes.topMouseUp, topLevelTypes.topSelectionChange]
  }
};

var activeElement = null;
var activeElementID = null;
var lastSelection = null;
var mouseDown = false;

// Track whether a listener exists for this plugin. If none exist, we do
// not extract events.
var hasListener = false;
var ON_SELECT_KEY = keyOf({ onSelect: null });

/**
 * Get an object which is a unique representation of the current selection.
 *
 * The return value will not be consistent across nodes or browsers, but
 * two identical selections on the same node will return identical objects.
 *
 * @param {DOMElement} node
 * @return {object}
 */
function getSelection(node) {
  if ('selectionStart' in node && ReactInputSelection.hasSelectionCapabilities(node)) {
    return {
      start: node.selectionStart,
      end: node.selectionEnd
    };
  } else if (window.getSelection) {
    var selection = window.getSelection();
    return {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset
    };
  } else if (document.selection) {
    var range = document.selection.createRange();
    return {
      parentElement: range.parentElement(),
      text: range.text,
      top: range.boundingTop,
      left: range.boundingLeft
    };
  }
}

/**
 * Poll selection to see whether it's changed.
 *
 * @param {object} nativeEvent
 * @return {?SyntheticEvent}
 */
function constructSelectEvent(nativeEvent, nativeEventTarget) {
  // Ensure we have the right element, and that the user is not dragging a
  // selection (this matches native `select` event behavior). In HTML5, select
  // fires only on input and textarea thus if there's no focused element we
  // won't dispatch.
  if (mouseDown || activeElement == null || activeElement !== getActiveElement()) {
    return null;
  }

  // Only fire when selection has actually changed.
  var currentSelection = getSelection(activeElement);
  if (!lastSelection || !shallowEqual(lastSelection, currentSelection)) {
    lastSelection = currentSelection;

    var syntheticEvent = SyntheticEvent.getPooled(eventTypes.select, activeElementID, nativeEvent, nativeEventTarget);

    syntheticEvent.type = 'select';
    syntheticEvent.target = activeElement;

    EventPropagators.accumulateTwoPhaseDispatches(syntheticEvent);

    return syntheticEvent;
  }

  return null;
}

/**
 * This plugin creates an `onSelect` event that normalizes select events
 * across form elements.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - contentEditable
 *
 * This differs from native browser implementations in the following ways:
 * - Fires on contentEditable fields as well as inputs.
 * - Fires for collapsed selection.
 * - Fires after user input.
 */
var SelectEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function (topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
    if (!hasListener) {
      return null;
    }

    switch (topLevelType) {
      // Track the input node that has focus.
      case topLevelTypes.topFocus:
        if (isTextInputElement(topLevelTarget) || topLevelTarget.contentEditable === 'true') {
          activeElement = topLevelTarget;
          activeElementID = topLevelTargetID;
          lastSelection = null;
        }
        break;
      case topLevelTypes.topBlur:
        activeElement = null;
        activeElementID = null;
        lastSelection = null;
        break;

      // Don't fire the event while the user is dragging. This matches the
      // semantics of the native select event.
      case topLevelTypes.topMouseDown:
        mouseDown = true;
        break;
      case topLevelTypes.topContextMenu:
      case topLevelTypes.topMouseUp:
        mouseDown = false;
        return constructSelectEvent(nativeEvent, nativeEventTarget);

      // Chrome and IE fire non-standard event when selection is changed (and
      // sometimes when it hasn't). IE's event fires out of order with respect
      // to key and input events on deletion, so we discard it.
      //
      // Firefox doesn't support selectionchange, so check selection status
      // after each key entry. The selection changes after keydown and before
      // keyup, but we check on keydown as well in the case of holding down a
      // key, when multiple keydown events are fired but only one keyup is.
      // This is also our approach for IE handling, for the reason above.
      case topLevelTypes.topSelectionChange:
        if (skipSelectionChangeEvent) {
          break;
        }
      // falls through
      case topLevelTypes.topKeyDown:
      case topLevelTypes.topKeyUp:
        return constructSelectEvent(nativeEvent, nativeEventTarget);
    }

    return null;
  },

  didPutListener: function (id, registrationName, listener) {
    if (registrationName === ON_SELECT_KEY) {
      hasListener = true;
    }
  }
};

module.exports = SelectEventPlugin;
},{"./EventConstants":70,"./EventPropagators":74,"./ReactInputSelection":116,"./SyntheticEvent":148,"./isTextInputElement":176,"fbjs/lib/ExecutionEnvironment":186,"fbjs/lib/getActiveElement":195,"fbjs/lib/keyOf":204,"fbjs/lib/shallowEqual":209}],143:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ServerReactRootIndex
 * @typechecks
 */

'use strict';

/**
 * Size of the reactRoot ID space. We generate random numbers for React root
 * IDs and if there's a collision the events and DOM update system will
 * get confused. In the future we need a way to generate GUIDs but for
 * now this will work on a smaller scale.
 */
var GLOBAL_MOUNT_POINT_MAX = Math.pow(2, 53);

var ServerReactRootIndex = {
  createReactRootIndex: function () {
    return Math.ceil(Math.random() * GLOBAL_MOUNT_POINT_MAX);
  }
};

module.exports = ServerReactRootIndex;
},{}],144:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SimpleEventPlugin
 */

'use strict';

var EventConstants = require('./EventConstants');
var EventListener = require('fbjs/lib/EventListener');
var EventPropagators = require('./EventPropagators');
var ReactMount = require('./ReactMount');
var SyntheticClipboardEvent = require('./SyntheticClipboardEvent');
var SyntheticEvent = require('./SyntheticEvent');
var SyntheticFocusEvent = require('./SyntheticFocusEvent');
var SyntheticKeyboardEvent = require('./SyntheticKeyboardEvent');
var SyntheticMouseEvent = require('./SyntheticMouseEvent');
var SyntheticDragEvent = require('./SyntheticDragEvent');
var SyntheticTouchEvent = require('./SyntheticTouchEvent');
var SyntheticUIEvent = require('./SyntheticUIEvent');
var SyntheticWheelEvent = require('./SyntheticWheelEvent');

var emptyFunction = require('fbjs/lib/emptyFunction');
var getEventCharCode = require('./getEventCharCode');
var invariant = require('fbjs/lib/invariant');
var keyOf = require('fbjs/lib/keyOf');

var topLevelTypes = EventConstants.topLevelTypes;

var eventTypes = {
  abort: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onAbort: true }),
      captured: keyOf({ onAbortCapture: true })
    }
  },
  blur: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onBlur: true }),
      captured: keyOf({ onBlurCapture: true })
    }
  },
  canPlay: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onCanPlay: true }),
      captured: keyOf({ onCanPlayCapture: true })
    }
  },
  canPlayThrough: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onCanPlayThrough: true }),
      captured: keyOf({ onCanPlayThroughCapture: true })
    }
  },
  click: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onClick: true }),
      captured: keyOf({ onClickCapture: true })
    }
  },
  contextMenu: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onContextMenu: true }),
      captured: keyOf({ onContextMenuCapture: true })
    }
  },
  copy: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onCopy: true }),
      captured: keyOf({ onCopyCapture: true })
    }
  },
  cut: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onCut: true }),
      captured: keyOf({ onCutCapture: true })
    }
  },
  doubleClick: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDoubleClick: true }),
      captured: keyOf({ onDoubleClickCapture: true })
    }
  },
  drag: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDrag: true }),
      captured: keyOf({ onDragCapture: true })
    }
  },
  dragEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDragEnd: true }),
      captured: keyOf({ onDragEndCapture: true })
    }
  },
  dragEnter: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDragEnter: true }),
      captured: keyOf({ onDragEnterCapture: true })
    }
  },
  dragExit: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDragExit: true }),
      captured: keyOf({ onDragExitCapture: true })
    }
  },
  dragLeave: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDragLeave: true }),
      captured: keyOf({ onDragLeaveCapture: true })
    }
  },
  dragOver: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDragOver: true }),
      captured: keyOf({ onDragOverCapture: true })
    }
  },
  dragStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDragStart: true }),
      captured: keyOf({ onDragStartCapture: true })
    }
  },
  drop: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDrop: true }),
      captured: keyOf({ onDropCapture: true })
    }
  },
  durationChange: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onDurationChange: true }),
      captured: keyOf({ onDurationChangeCapture: true })
    }
  },
  emptied: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onEmptied: true }),
      captured: keyOf({ onEmptiedCapture: true })
    }
  },
  encrypted: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onEncrypted: true }),
      captured: keyOf({ onEncryptedCapture: true })
    }
  },
  ended: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onEnded: true }),
      captured: keyOf({ onEndedCapture: true })
    }
  },
  error: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onError: true }),
      captured: keyOf({ onErrorCapture: true })
    }
  },
  focus: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onFocus: true }),
      captured: keyOf({ onFocusCapture: true })
    }
  },
  input: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onInput: true }),
      captured: keyOf({ onInputCapture: true })
    }
  },
  keyDown: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onKeyDown: true }),
      captured: keyOf({ onKeyDownCapture: true })
    }
  },
  keyPress: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onKeyPress: true }),
      captured: keyOf({ onKeyPressCapture: true })
    }
  },
  keyUp: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onKeyUp: true }),
      captured: keyOf({ onKeyUpCapture: true })
    }
  },
  load: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onLoad: true }),
      captured: keyOf({ onLoadCapture: true })
    }
  },
  loadedData: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onLoadedData: true }),
      captured: keyOf({ onLoadedDataCapture: true })
    }
  },
  loadedMetadata: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onLoadedMetadata: true }),
      captured: keyOf({ onLoadedMetadataCapture: true })
    }
  },
  loadStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onLoadStart: true }),
      captured: keyOf({ onLoadStartCapture: true })
    }
  },
  // Note: We do not allow listening to mouseOver events. Instead, use the
  // onMouseEnter/onMouseLeave created by `EnterLeaveEventPlugin`.
  mouseDown: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onMouseDown: true }),
      captured: keyOf({ onMouseDownCapture: true })
    }
  },
  mouseMove: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onMouseMove: true }),
      captured: keyOf({ onMouseMoveCapture: true })
    }
  },
  mouseOut: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onMouseOut: true }),
      captured: keyOf({ onMouseOutCapture: true })
    }
  },
  mouseOver: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onMouseOver: true }),
      captured: keyOf({ onMouseOverCapture: true })
    }
  },
  mouseUp: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onMouseUp: true }),
      captured: keyOf({ onMouseUpCapture: true })
    }
  },
  paste: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onPaste: true }),
      captured: keyOf({ onPasteCapture: true })
    }
  },
  pause: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onPause: true }),
      captured: keyOf({ onPauseCapture: true })
    }
  },
  play: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onPlay: true }),
      captured: keyOf({ onPlayCapture: true })
    }
  },
  playing: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onPlaying: true }),
      captured: keyOf({ onPlayingCapture: true })
    }
  },
  progress: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onProgress: true }),
      captured: keyOf({ onProgressCapture: true })
    }
  },
  rateChange: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onRateChange: true }),
      captured: keyOf({ onRateChangeCapture: true })
    }
  },
  reset: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onReset: true }),
      captured: keyOf({ onResetCapture: true })
    }
  },
  scroll: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onScroll: true }),
      captured: keyOf({ onScrollCapture: true })
    }
  },
  seeked: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onSeeked: true }),
      captured: keyOf({ onSeekedCapture: true })
    }
  },
  seeking: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onSeeking: true }),
      captured: keyOf({ onSeekingCapture: true })
    }
  },
  stalled: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onStalled: true }),
      captured: keyOf({ onStalledCapture: true })
    }
  },
  submit: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onSubmit: true }),
      captured: keyOf({ onSubmitCapture: true })
    }
  },
  suspend: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onSuspend: true }),
      captured: keyOf({ onSuspendCapture: true })
    }
  },
  timeUpdate: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onTimeUpdate: true }),
      captured: keyOf({ onTimeUpdateCapture: true })
    }
  },
  touchCancel: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onTouchCancel: true }),
      captured: keyOf({ onTouchCancelCapture: true })
    }
  },
  touchEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onTouchEnd: true }),
      captured: keyOf({ onTouchEndCapture: true })
    }
  },
  touchMove: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onTouchMove: true }),
      captured: keyOf({ onTouchMoveCapture: true })
    }
  },
  touchStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onTouchStart: true }),
      captured: keyOf({ onTouchStartCapture: true })
    }
  },
  volumeChange: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onVolumeChange: true }),
      captured: keyOf({ onVolumeChangeCapture: true })
    }
  },
  waiting: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onWaiting: true }),
      captured: keyOf({ onWaitingCapture: true })
    }
  },
  wheel: {
    phasedRegistrationNames: {
      bubbled: keyOf({ onWheel: true }),
      captured: keyOf({ onWheelCapture: true })
    }
  }
};

var topLevelEventsToDispatchConfig = {
  topAbort: eventTypes.abort,
  topBlur: eventTypes.blur,
  topCanPlay: eventTypes.canPlay,
  topCanPlayThrough: eventTypes.canPlayThrough,
  topClick: eventTypes.click,
  topContextMenu: eventTypes.contextMenu,
  topCopy: eventTypes.copy,
  topCut: eventTypes.cut,
  topDoubleClick: eventTypes.doubleClick,
  topDrag: eventTypes.drag,
  topDragEnd: eventTypes.dragEnd,
  topDragEnter: eventTypes.dragEnter,
  topDragExit: eventTypes.dragExit,
  topDragLeave: eventTypes.dragLeave,
  topDragOver: eventTypes.dragOver,
  topDragStart: eventTypes.dragStart,
  topDrop: eventTypes.drop,
  topDurationChange: eventTypes.durationChange,
  topEmptied: eventTypes.emptied,
  topEncrypted: eventTypes.encrypted,
  topEnded: eventTypes.ended,
  topError: eventTypes.error,
  topFocus: eventTypes.focus,
  topInput: eventTypes.input,
  topKeyDown: eventTypes.keyDown,
  topKeyPress: eventTypes.keyPress,
  topKeyUp: eventTypes.keyUp,
  topLoad: eventTypes.load,
  topLoadedData: eventTypes.loadedData,
  topLoadedMetadata: eventTypes.loadedMetadata,
  topLoadStart: eventTypes.loadStart,
  topMouseDown: eventTypes.mouseDown,
  topMouseMove: eventTypes.mouseMove,
  topMouseOut: eventTypes.mouseOut,
  topMouseOver: eventTypes.mouseOver,
  topMouseUp: eventTypes.mouseUp,
  topPaste: eventTypes.paste,
  topPause: eventTypes.pause,
  topPlay: eventTypes.play,
  topPlaying: eventTypes.playing,
  topProgress: eventTypes.progress,
  topRateChange: eventTypes.rateChange,
  topReset: eventTypes.reset,
  topScroll: eventTypes.scroll,
  topSeeked: eventTypes.seeked,
  topSeeking: eventTypes.seeking,
  topStalled: eventTypes.stalled,
  topSubmit: eventTypes.submit,
  topSuspend: eventTypes.suspend,
  topTimeUpdate: eventTypes.timeUpdate,
  topTouchCancel: eventTypes.touchCancel,
  topTouchEnd: eventTypes.touchEnd,
  topTouchMove: eventTypes.touchMove,
  topTouchStart: eventTypes.touchStart,
  topVolumeChange: eventTypes.volumeChange,
  topWaiting: eventTypes.waiting,
  topWheel: eventTypes.wheel
};

for (var type in topLevelEventsToDispatchConfig) {
  topLevelEventsToDispatchConfig[type].dependencies = [type];
}

var ON_CLICK_KEY = keyOf({ onClick: null });
var onClickListeners = {};

var SimpleEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function (topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
    var dispatchConfig = topLevelEventsToDispatchConfig[topLevelType];
    if (!dispatchConfig) {
      return null;
    }
    var EventConstructor;
    switch (topLevelType) {
      case topLevelTypes.topAbort:
      case topLevelTypes.topCanPlay:
      case topLevelTypes.topCanPlayThrough:
      case topLevelTypes.topDurationChange:
      case topLevelTypes.topEmptied:
      case topLevelTypes.topEncrypted:
      case topLevelTypes.topEnded:
      case topLevelTypes.topError:
      case topLevelTypes.topInput:
      case topLevelTypes.topLoad:
      case topLevelTypes.topLoadedData:
      case topLevelTypes.topLoadedMetadata:
      case topLevelTypes.topLoadStart:
      case topLevelTypes.topPause:
      case topLevelTypes.topPlay:
      case topLevelTypes.topPlaying:
      case topLevelTypes.topProgress:
      case topLevelTypes.topRateChange:
      case topLevelTypes.topReset:
      case topLevelTypes.topSeeked:
      case topLevelTypes.topSeeking:
      case topLevelTypes.topStalled:
      case topLevelTypes.topSubmit:
      case topLevelTypes.topSuspend:
      case topLevelTypes.topTimeUpdate:
      case topLevelTypes.topVolumeChange:
      case topLevelTypes.topWaiting:
        // HTML Events
        // @see http://www.w3.org/TR/html5/index.html#events-0
        EventConstructor = SyntheticEvent;
        break;
      case topLevelTypes.topKeyPress:
        // FireFox creates a keypress event for function keys too. This removes
        // the unwanted keypress events. Enter is however both printable and
        // non-printable. One would expect Tab to be as well (but it isn't).
        if (getEventCharCode(nativeEvent) === 0) {
          return null;
        }
      /* falls through */
      case topLevelTypes.topKeyDown:
      case topLevelTypes.topKeyUp:
        EventConstructor = SyntheticKeyboardEvent;
        break;
      case topLevelTypes.topBlur:
      case topLevelTypes.topFocus:
        EventConstructor = SyntheticFocusEvent;
        break;
      case topLevelTypes.topClick:
        // Firefox creates a click event on right mouse clicks. This removes the
        // unwanted click events.
        if (nativeEvent.button === 2) {
          return null;
        }
      /* falls through */
      case topLevelTypes.topContextMenu:
      case topLevelTypes.topDoubleClick:
      case topLevelTypes.topMouseDown:
      case topLevelTypes.topMouseMove:
      case topLevelTypes.topMouseOut:
      case topLevelTypes.topMouseOver:
      case topLevelTypes.topMouseUp:
        EventConstructor = SyntheticMouseEvent;
        break;
      case topLevelTypes.topDrag:
      case topLevelTypes.topDragEnd:
      case topLevelTypes.topDragEnter:
      case topLevelTypes.topDragExit:
      case topLevelTypes.topDragLeave:
      case topLevelTypes.topDragOver:
      case topLevelTypes.topDragStart:
      case topLevelTypes.topDrop:
        EventConstructor = SyntheticDragEvent;
        break;
      case topLevelTypes.topTouchCancel:
      case topLevelTypes.topTouchEnd:
      case topLevelTypes.topTouchMove:
      case topLevelTypes.topTouchStart:
        EventConstructor = SyntheticTouchEvent;
        break;
      case topLevelTypes.topScroll:
        EventConstructor = SyntheticUIEvent;
        break;
      case topLevelTypes.topWheel:
        EventConstructor = SyntheticWheelEvent;
        break;
      case topLevelTypes.topCopy:
      case topLevelTypes.topCut:
      case topLevelTypes.topPaste:
        EventConstructor = SyntheticClipboardEvent;
        break;
    }
    !EventConstructor ? "production" !== 'production' ? invariant(false, 'SimpleEventPlugin: Unhandled event type, `%s`.', topLevelType) : invariant(false) : undefined;
    var event = EventConstructor.getPooled(dispatchConfig, topLevelTargetID, nativeEvent, nativeEventTarget);
    EventPropagators.accumulateTwoPhaseDispatches(event);
    return event;
  },

  didPutListener: function (id, registrationName, listener) {
    // Mobile Safari does not fire properly bubble click events on
    // non-interactive elements, which means delegated click listeners do not
    // fire. The workaround for this bug involves attaching an empty click
    // listener on the target node.
    if (registrationName === ON_CLICK_KEY) {
      var node = ReactMount.getNode(id);
      if (!onClickListeners[id]) {
        onClickListeners[id] = EventListener.listen(node, 'click', emptyFunction);
      }
    }
  },

  willDeleteListener: function (id, registrationName) {
    if (registrationName === ON_CLICK_KEY) {
      onClickListeners[id].remove();
      delete onClickListeners[id];
    }
  }

};

module.exports = SimpleEventPlugin;
},{"./EventConstants":70,"./EventPropagators":74,"./ReactMount":121,"./SyntheticClipboardEvent":145,"./SyntheticDragEvent":147,"./SyntheticEvent":148,"./SyntheticFocusEvent":149,"./SyntheticKeyboardEvent":151,"./SyntheticMouseEvent":152,"./SyntheticTouchEvent":153,"./SyntheticUIEvent":154,"./SyntheticWheelEvent":155,"./getEventCharCode":167,"fbjs/lib/EventListener":185,"fbjs/lib/emptyFunction":192,"fbjs/lib/invariant":200,"fbjs/lib/keyOf":204}],145:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticClipboardEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticEvent = require('./SyntheticEvent');

/**
 * @interface Event
 * @see http://www.w3.org/TR/clipboard-apis/
 */
var ClipboardEventInterface = {
  clipboardData: function (event) {
    return 'clipboardData' in event ? event.clipboardData : window.clipboardData;
  }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticClipboardEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent.augmentClass(SyntheticClipboardEvent, ClipboardEventInterface);

module.exports = SyntheticClipboardEvent;
},{"./SyntheticEvent":148}],146:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticCompositionEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticEvent = require('./SyntheticEvent');

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#events-compositionevents
 */
var CompositionEventInterface = {
  data: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticCompositionEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent.augmentClass(SyntheticCompositionEvent, CompositionEventInterface);

module.exports = SyntheticCompositionEvent;
},{"./SyntheticEvent":148}],147:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticDragEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticMouseEvent = require('./SyntheticMouseEvent');

/**
 * @interface DragEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var DragEventInterface = {
  dataTransfer: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticDragEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticMouseEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticMouseEvent.augmentClass(SyntheticDragEvent, DragEventInterface);

module.exports = SyntheticDragEvent;
},{"./SyntheticMouseEvent":152}],148:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticEvent
 * @typechecks static-only
 */

'use strict';

var PooledClass = require('./PooledClass');

var assign = require('./Object.assign');
var emptyFunction = require('fbjs/lib/emptyFunction');
var warning = require('fbjs/lib/warning');

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var EventInterface = {
  type: null,
  target: null,
  // currentTarget is set when dispatching; no use in copying it here
  currentTarget: emptyFunction.thatReturnsNull,
  eventPhase: null,
  bubbles: null,
  cancelable: null,
  timeStamp: function (event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: null,
  isTrusted: null
};

/**
 * Synthetic events are dispatched by event plugins, typically in response to a
 * top-level event delegation handler.
 *
 * These systems should generally use pooling to reduce the frequency of garbage
 * collection. The system should check `isPersistent` to determine whether the
 * event should be released into the pool after being dispatched. Users that
 * need a persisted event should invoke `persist`.
 *
 * Synthetic events (and subclasses) implement the DOM Level 3 Events API by
 * normalizing browser quirks. Subclasses do not necessarily have to implement a
 * DOM interface; custom application-specific events can also subclass this.
 *
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 */
function SyntheticEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  this.dispatchConfig = dispatchConfig;
  this.dispatchMarker = dispatchMarker;
  this.nativeEvent = nativeEvent;

  var Interface = this.constructor.Interface;
  for (var propName in Interface) {
    if (!Interface.hasOwnProperty(propName)) {
      continue;
    }
    var normalize = Interface[propName];
    if (normalize) {
      this[propName] = normalize(nativeEvent);
    } else {
      if (propName === 'target') {
        this.target = nativeEventTarget;
      } else {
        this[propName] = nativeEvent[propName];
      }
    }
  }

  var defaultPrevented = nativeEvent.defaultPrevented != null ? nativeEvent.defaultPrevented : nativeEvent.returnValue === false;
  if (defaultPrevented) {
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  } else {
    this.isDefaultPrevented = emptyFunction.thatReturnsFalse;
  }
  this.isPropagationStopped = emptyFunction.thatReturnsFalse;
}

assign(SyntheticEvent.prototype, {

  preventDefault: function () {
    this.defaultPrevented = true;
    var event = this.nativeEvent;
    if ("production" !== 'production') {
      "production" !== 'production' ? warning(event, 'This synthetic event is reused for performance reasons. If you\'re ' + 'seeing this, you\'re calling `preventDefault` on a ' + 'released/nullified synthetic event. This is a no-op. See ' + 'https://fb.me/react-event-pooling for more information.') : undefined;
    }
    if (!event) {
      return;
    }

    if (event.preventDefault) {
      event.preventDefault();
    } else {
      event.returnValue = false;
    }
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  },

  stopPropagation: function () {
    var event = this.nativeEvent;
    if ("production" !== 'production') {
      "production" !== 'production' ? warning(event, 'This synthetic event is reused for performance reasons. If you\'re ' + 'seeing this, you\'re calling `stopPropagation` on a ' + 'released/nullified synthetic event. This is a no-op. See ' + 'https://fb.me/react-event-pooling for more information.') : undefined;
    }
    if (!event) {
      return;
    }

    if (event.stopPropagation) {
      event.stopPropagation();
    } else {
      event.cancelBubble = true;
    }
    this.isPropagationStopped = emptyFunction.thatReturnsTrue;
  },

  /**
   * We release all dispatched `SyntheticEvent`s after each event loop, adding
   * them back into the pool. This allows a way to hold onto a reference that
   * won't be added back into the pool.
   */
  persist: function () {
    this.isPersistent = emptyFunction.thatReturnsTrue;
  },

  /**
   * Checks if this event should be released back into the pool.
   *
   * @return {boolean} True if this should not be released, false otherwise.
   */
  isPersistent: emptyFunction.thatReturnsFalse,

  /**
   * `PooledClass` looks for `destructor` on each instance it releases.
   */
  destructor: function () {
    var Interface = this.constructor.Interface;
    for (var propName in Interface) {
      this[propName] = null;
    }
    this.dispatchConfig = null;
    this.dispatchMarker = null;
    this.nativeEvent = null;
  }

});

SyntheticEvent.Interface = EventInterface;

/**
 * Helper to reduce boilerplate when creating subclasses.
 *
 * @param {function} Class
 * @param {?object} Interface
 */
SyntheticEvent.augmentClass = function (Class, Interface) {
  var Super = this;

  var prototype = Object.create(Super.prototype);
  assign(prototype, Class.prototype);
  Class.prototype = prototype;
  Class.prototype.constructor = Class;

  Class.Interface = assign({}, Super.Interface, Interface);
  Class.augmentClass = Super.augmentClass;

  PooledClass.addPoolingTo(Class, PooledClass.fourArgumentPooler);
};

PooledClass.addPoolingTo(SyntheticEvent, PooledClass.fourArgumentPooler);

module.exports = SyntheticEvent;
},{"./Object.assign":78,"./PooledClass":79,"fbjs/lib/emptyFunction":192,"fbjs/lib/warning":211}],149:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticFocusEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticUIEvent = require('./SyntheticUIEvent');

/**
 * @interface FocusEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var FocusEventInterface = {
  relatedTarget: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticFocusEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticUIEvent.augmentClass(SyntheticFocusEvent, FocusEventInterface);

module.exports = SyntheticFocusEvent;
},{"./SyntheticUIEvent":154}],150:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticInputEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticEvent = require('./SyntheticEvent');

/**
 * @interface Event
 * @see http://www.w3.org/TR/2013/WD-DOM-Level-3-Events-20131105
 *      /#events-inputevents
 */
var InputEventInterface = {
  data: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticInputEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent.augmentClass(SyntheticInputEvent, InputEventInterface);

module.exports = SyntheticInputEvent;
},{"./SyntheticEvent":148}],151:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticKeyboardEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticUIEvent = require('./SyntheticUIEvent');

var getEventCharCode = require('./getEventCharCode');
var getEventKey = require('./getEventKey');
var getEventModifierState = require('./getEventModifierState');

/**
 * @interface KeyboardEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var KeyboardEventInterface = {
  key: getEventKey,
  location: null,
  ctrlKey: null,
  shiftKey: null,
  altKey: null,
  metaKey: null,
  repeat: null,
  locale: null,
  getModifierState: getEventModifierState,
  // Legacy Interface
  charCode: function (event) {
    // `charCode` is the result of a KeyPress event and represents the value of
    // the actual printable character.

    // KeyPress is deprecated, but its replacement is not yet final and not
    // implemented in any major browser. Only KeyPress has charCode.
    if (event.type === 'keypress') {
      return getEventCharCode(event);
    }
    return 0;
  },
  keyCode: function (event) {
    // `keyCode` is the result of a KeyDown/Up event and represents the value of
    // physical keyboard key.

    // The actual meaning of the value depends on the users' keyboard layout
    // which cannot be detected. Assuming that it is a US keyboard layout
    // provides a surprisingly accurate mapping for US and European users.
    // Due to this, it is left to the user to implement at this time.
    if (event.type === 'keydown' || event.type === 'keyup') {
      return event.keyCode;
    }
    return 0;
  },
  which: function (event) {
    // `which` is an alias for either `keyCode` or `charCode` depending on the
    // type of the event.
    if (event.type === 'keypress') {
      return getEventCharCode(event);
    }
    if (event.type === 'keydown' || event.type === 'keyup') {
      return event.keyCode;
    }
    return 0;
  }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticKeyboardEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticUIEvent.augmentClass(SyntheticKeyboardEvent, KeyboardEventInterface);

module.exports = SyntheticKeyboardEvent;
},{"./SyntheticUIEvent":154,"./getEventCharCode":167,"./getEventKey":168,"./getEventModifierState":169}],152:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticMouseEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticUIEvent = require('./SyntheticUIEvent');
var ViewportMetrics = require('./ViewportMetrics');

var getEventModifierState = require('./getEventModifierState');

/**
 * @interface MouseEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var MouseEventInterface = {
  screenX: null,
  screenY: null,
  clientX: null,
  clientY: null,
  ctrlKey: null,
  shiftKey: null,
  altKey: null,
  metaKey: null,
  getModifierState: getEventModifierState,
  button: function (event) {
    // Webkit, Firefox, IE9+
    // which:  1 2 3
    // button: 0 1 2 (standard)
    var button = event.button;
    if ('which' in event) {
      return button;
    }
    // IE<9
    // which:  undefined
    // button: 0 0 0
    // button: 1 4 2 (onmouseup)
    return button === 2 ? 2 : button === 4 ? 1 : 0;
  },
  buttons: null,
  relatedTarget: function (event) {
    return event.relatedTarget || (event.fromElement === event.srcElement ? event.toElement : event.fromElement);
  },
  // "Proprietary" Interface.
  pageX: function (event) {
    return 'pageX' in event ? event.pageX : event.clientX + ViewportMetrics.currentScrollLeft;
  },
  pageY: function (event) {
    return 'pageY' in event ? event.pageY : event.clientY + ViewportMetrics.currentScrollTop;
  }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticMouseEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticUIEvent.augmentClass(SyntheticMouseEvent, MouseEventInterface);

module.exports = SyntheticMouseEvent;
},{"./SyntheticUIEvent":154,"./ViewportMetrics":157,"./getEventModifierState":169}],153:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticTouchEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticUIEvent = require('./SyntheticUIEvent');

var getEventModifierState = require('./getEventModifierState');

/**
 * @interface TouchEvent
 * @see http://www.w3.org/TR/touch-events/
 */
var TouchEventInterface = {
  touches: null,
  targetTouches: null,
  changedTouches: null,
  altKey: null,
  metaKey: null,
  ctrlKey: null,
  shiftKey: null,
  getModifierState: getEventModifierState
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticTouchEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticUIEvent.augmentClass(SyntheticTouchEvent, TouchEventInterface);

module.exports = SyntheticTouchEvent;
},{"./SyntheticUIEvent":154,"./getEventModifierState":169}],154:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticUIEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticEvent = require('./SyntheticEvent');

var getEventTarget = require('./getEventTarget');

/**
 * @interface UIEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var UIEventInterface = {
  view: function (event) {
    if (event.view) {
      return event.view;
    }

    var target = getEventTarget(event);
    if (target != null && target.window === target) {
      // target is a window object
      return target;
    }

    var doc = target.ownerDocument;
    // TODO: Figure out why `ownerDocument` is sometimes undefined in IE8.
    if (doc) {
      return doc.defaultView || doc.parentWindow;
    } else {
      return window;
    }
  },
  detail: function (event) {
    return event.detail || 0;
  }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticEvent}
 */
function SyntheticUIEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent.augmentClass(SyntheticUIEvent, UIEventInterface);

module.exports = SyntheticUIEvent;
},{"./SyntheticEvent":148,"./getEventTarget":170}],155:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticWheelEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticMouseEvent = require('./SyntheticMouseEvent');

/**
 * @interface WheelEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var WheelEventInterface = {
  deltaX: function (event) {
    return 'deltaX' in event ? event.deltaX :
    // Fallback to `wheelDeltaX` for Webkit and normalize (right is positive).
    'wheelDeltaX' in event ? -event.wheelDeltaX : 0;
  },
  deltaY: function (event) {
    return 'deltaY' in event ? event.deltaY :
    // Fallback to `wheelDeltaY` for Webkit and normalize (down is positive).
    'wheelDeltaY' in event ? -event.wheelDeltaY :
    // Fallback to `wheelDelta` for IE<9 and normalize (down is positive).
    'wheelDelta' in event ? -event.wheelDelta : 0;
  },
  deltaZ: null,

  // Browsers without "deltaMode" is reporting in raw wheel delta where one
  // notch on the scroll is always +/- 120, roughly equivalent to pixels.
  // A good approximation of DOM_DELTA_LINE (1) is 5% of viewport size or
  // ~40 pixels, for DOM_DELTA_SCREEN (2) it is 87.5% of viewport size.
  deltaMode: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticMouseEvent}
 */
function SyntheticWheelEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
  SyntheticMouseEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticMouseEvent.augmentClass(SyntheticWheelEvent, WheelEventInterface);

module.exports = SyntheticWheelEvent;
},{"./SyntheticMouseEvent":152}],156:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Transaction
 */

'use strict';

var invariant = require('fbjs/lib/invariant');

/**
 * `Transaction` creates a black box that is able to wrap any method such that
 * certain invariants are maintained before and after the method is invoked
 * (Even if an exception is thrown while invoking the wrapped method). Whoever
 * instantiates a transaction can provide enforcers of the invariants at
 * creation time. The `Transaction` class itself will supply one additional
 * automatic invariant for you - the invariant that any transaction instance
 * should not be run while it is already being run. You would typically create a
 * single instance of a `Transaction` for reuse multiple times, that potentially
 * is used to wrap several different methods. Wrappers are extremely simple -
 * they only require implementing two methods.
 *
 * <pre>
 *                       wrappers (injected at creation time)
 *                                      +        +
 *                                      |        |
 *                    +-----------------|--------|--------------+
 *                    |                 v        |              |
 *                    |      +---------------+   |              |
 *                    |   +--|    wrapper1   |---|----+         |
 *                    |   |  +---------------+   v    |         |
 *                    |   |          +-------------+  |         |
 *                    |   |     +----|   wrapper2  |--------+   |
 *                    |   |     |    +-------------+  |     |   |
 *                    |   |     |                     |     |   |
 *                    |   v     v                     v     v   | wrapper
 *                    | +---+ +---+   +---------+   +---+ +---+ | invariants
 * perform(anyMethod) | |   | |   |   |         |   |   | |   | | maintained
 * +----------------->|-|---|-|---|-->|anyMethod|---|---|-|---|-|-------->
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | +---+ +---+   +---------+   +---+ +---+ |
 *                    |  initialize                    close    |
 *                    +-----------------------------------------+
 * </pre>
 *
 * Use cases:
 * - Preserving the input selection ranges before/after reconciliation.
 *   Restoring selection even in the event of an unexpected error.
 * - Deactivating events while rearranging the DOM, preventing blurs/focuses,
 *   while guaranteeing that afterwards, the event system is reactivated.
 * - Flushing a queue of collected DOM mutations to the main UI thread after a
 *   reconciliation takes place in a worker thread.
 * - Invoking any collected `componentDidUpdate` callbacks after rendering new
 *   content.
 * - (Future use case): Wrapping particular flushes of the `ReactWorker` queue
 *   to preserve the `scrollTop` (an automatic scroll aware DOM).
 * - (Future use case): Layout calculations before and after DOM updates.
 *
 * Transactional plugin API:
 * - A module that has an `initialize` method that returns any precomputation.
 * - and a `close` method that accepts the precomputation. `close` is invoked
 *   when the wrapped process is completed, or has failed.
 *
 * @param {Array<TransactionalWrapper>} transactionWrapper Wrapper modules
 * that implement `initialize` and `close`.
 * @return {Transaction} Single transaction for reuse in thread.
 *
 * @class Transaction
 */
var Mixin = {
  /**
   * Sets up this instance so that it is prepared for collecting metrics. Does
   * so such that this setup method may be used on an instance that is already
   * initialized, in a way that does not consume additional memory upon reuse.
   * That can be useful if you decide to make your subclass of this mixin a
   * "PooledClass".
   */
  reinitializeTransaction: function () {
    this.transactionWrappers = this.getTransactionWrappers();
    if (this.wrapperInitData) {
      this.wrapperInitData.length = 0;
    } else {
      this.wrapperInitData = [];
    }
    this._isInTransaction = false;
  },

  _isInTransaction: false,

  /**
   * @abstract
   * @return {Array<TransactionWrapper>} Array of transaction wrappers.
   */
  getTransactionWrappers: null,

  isInTransaction: function () {
    return !!this._isInTransaction;
  },

  /**
   * Executes the function within a safety window. Use this for the top level
   * methods that result in large amounts of computation/mutations that would
   * need to be safety checked. The optional arguments helps prevent the need
   * to bind in many cases.
   *
   * @param {function} method Member of scope to call.
   * @param {Object} scope Scope to invoke from.
   * @param {Object?=} a Argument to pass to the method.
   * @param {Object?=} b Argument to pass to the method.
   * @param {Object?=} c Argument to pass to the method.
   * @param {Object?=} d Argument to pass to the method.
   * @param {Object?=} e Argument to pass to the method.
   * @param {Object?=} f Argument to pass to the method.
   *
   * @return {*} Return value from `method`.
   */
  perform: function (method, scope, a, b, c, d, e, f) {
    !!this.isInTransaction() ? "production" !== 'production' ? invariant(false, 'Transaction.perform(...): Cannot initialize a transaction when there ' + 'is already an outstanding transaction.') : invariant(false) : undefined;
    var errorThrown;
    var ret;
    try {
      this._isInTransaction = true;
      // Catching errors makes debugging more difficult, so we start with
      // errorThrown set to true before setting it to false after calling
      // close -- if it's still set to true in the finally block, it means
      // one of these calls threw.
      errorThrown = true;
      this.initializeAll(0);
      ret = method.call(scope, a, b, c, d, e, f);
      errorThrown = false;
    } finally {
      try {
        if (errorThrown) {
          // If `method` throws, prefer to show that stack trace over any thrown
          // by invoking `closeAll`.
          try {
            this.closeAll(0);
          } catch (err) {}
        } else {
          // Since `method` didn't throw, we don't want to silence the exception
          // here.
          this.closeAll(0);
        }
      } finally {
        this._isInTransaction = false;
      }
    }
    return ret;
  },

  initializeAll: function (startIndex) {
    var transactionWrappers = this.transactionWrappers;
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i];
      try {
        // Catching errors makes debugging more difficult, so we start with the
        // OBSERVED_ERROR state before overwriting it with the real return value
        // of initialize -- if it's still set to OBSERVED_ERROR in the finally
        // block, it means wrapper.initialize threw.
        this.wrapperInitData[i] = Transaction.OBSERVED_ERROR;
        this.wrapperInitData[i] = wrapper.initialize ? wrapper.initialize.call(this) : null;
      } finally {
        if (this.wrapperInitData[i] === Transaction.OBSERVED_ERROR) {
          // The initializer for wrapper i threw an error; initialize the
          // remaining wrappers but silence any exceptions from them to ensure
          // that the first error is the one to bubble up.
          try {
            this.initializeAll(i + 1);
          } catch (err) {}
        }
      }
    }
  },

  /**
   * Invokes each of `this.transactionWrappers.close[i]` functions, passing into
   * them the respective return values of `this.transactionWrappers.init[i]`
   * (`close`rs that correspond to initializers that failed will not be
   * invoked).
   */
  closeAll: function (startIndex) {
    !this.isInTransaction() ? "production" !== 'production' ? invariant(false, 'Transaction.closeAll(): Cannot close transaction when none are open.') : invariant(false) : undefined;
    var transactionWrappers = this.transactionWrappers;
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i];
      var initData = this.wrapperInitData[i];
      var errorThrown;
      try {
        // Catching errors makes debugging more difficult, so we start with
        // errorThrown set to true before setting it to false after calling
        // close -- if it's still set to true in the finally block, it means
        // wrapper.close threw.
        errorThrown = true;
        if (initData !== Transaction.OBSERVED_ERROR && wrapper.close) {
          wrapper.close.call(this, initData);
        }
        errorThrown = false;
      } finally {
        if (errorThrown) {
          // The closer for wrapper i threw an error; close the remaining
          // wrappers but silence any exceptions from them to ensure that the
          // first error is the one to bubble up.
          try {
            this.closeAll(i + 1);
          } catch (e) {}
        }
      }
    }
    this.wrapperInitData.length = 0;
  }
};

var Transaction = {

  Mixin: Mixin,

  /**
   * Token to look for to determine if an error occurred.
   */
  OBSERVED_ERROR: {}

};

module.exports = Transaction;
},{"fbjs/lib/invariant":200}],157:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViewportMetrics
 */

'use strict';

var ViewportMetrics = {

  currentScrollLeft: 0,

  currentScrollTop: 0,

  refreshScrollValues: function (scrollPosition) {
    ViewportMetrics.currentScrollLeft = scrollPosition.x;
    ViewportMetrics.currentScrollTop = scrollPosition.y;
  }

};

module.exports = ViewportMetrics;
},{}],158:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule accumulateInto
 */

'use strict';

var invariant = require('fbjs/lib/invariant');

/**
 *
 * Accumulates items that must not be null or undefined into the first one. This
 * is used to conserve memory by avoiding array allocations, and thus sacrifices
 * API cleanness. Since `current` can be null before being passed in and not
 * null after this function, make sure to assign it back to `current`:
 *
 * `a = accumulateInto(a, b);`
 *
 * This API should be sparingly used. Try `accumulate` for something cleaner.
 *
 * @return {*|array<*>} An accumulation of items.
 */

function accumulateInto(current, next) {
  !(next != null) ? "production" !== 'production' ? invariant(false, 'accumulateInto(...): Accumulated items must not be null or undefined.') : invariant(false) : undefined;
  if (current == null) {
    return next;
  }

  // Both are not empty. Warning: Never call x.concat(y) when you are not
  // certain that x is an Array (x could be a string with concat method).
  var currentIsArray = Array.isArray(current);
  var nextIsArray = Array.isArray(next);

  if (currentIsArray && nextIsArray) {
    current.push.apply(current, next);
    return current;
  }

  if (currentIsArray) {
    current.push(next);
    return current;
  }

  if (nextIsArray) {
    // A bit too dangerous to mutate `next`.
    return [current].concat(next);
  }

  return [current, next];
}

module.exports = accumulateInto;
},{"fbjs/lib/invariant":200}],159:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule adler32
 */

'use strict';

var MOD = 65521;

// adler32 is not cryptographically strong, and is only used to sanity check that
// markup generated on the server matches the markup generated on the client.
// This implementation (a modified version of the SheetJS version) has been optimized
// for our use case, at the expense of conforming to the adler32 specification
// for non-ascii inputs.
function adler32(data) {
  var a = 1;
  var b = 0;
  var i = 0;
  var l = data.length;
  var m = l & ~0x3;
  while (i < m) {
    for (; i < Math.min(i + 4096, m); i += 4) {
      b += (a += data.charCodeAt(i)) + (a += data.charCodeAt(i + 1)) + (a += data.charCodeAt(i + 2)) + (a += data.charCodeAt(i + 3));
    }
    a %= MOD;
    b %= MOD;
  }
  for (; i < l; i++) {
    b += a += data.charCodeAt(i);
  }
  a %= MOD;
  b %= MOD;
  return a | b << 16;
}

module.exports = adler32;
},{}],160:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule canDefineProperty
 */

'use strict';

var canDefineProperty = false;
if ("production" !== 'production') {
  try {
    Object.defineProperty({}, 'x', { get: function () {} });
    canDefineProperty = true;
  } catch (x) {
    // IE will fail on defineProperty
  }
}

module.exports = canDefineProperty;
},{}],161:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule dangerousStyleValue
 * @typechecks static-only
 */

'use strict';

var CSSProperty = require('./CSSProperty');

var isUnitlessNumber = CSSProperty.isUnitlessNumber;

/**
 * Convert a value into the proper css writable value. The style name `name`
 * should be logical (no hyphens), as specified
 * in `CSSProperty.isUnitlessNumber`.
 *
 * @param {string} name CSS property name such as `topMargin`.
 * @param {*} value CSS property value such as `10px`.
 * @return {string} Normalized style value with dimensions applied.
 */
function dangerousStyleValue(name, value) {
  // Note that we've removed escapeTextForBrowser() calls here since the
  // whole string will be escaped when the attribute is injected into
  // the markup. If you provide unsafe user data here they can inject
  // arbitrary CSS which may be problematic (I couldn't repro this):
  // https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet
  // http://www.thespanner.co.uk/2007/11/26/ultimate-xss-css-injection/
  // This is not an XSS hole but instead a potential CSS injection issue
  // which has lead to a greater discussion about how we're going to
  // trust URLs moving forward. See #2115901

  var isEmpty = value == null || typeof value === 'boolean' || value === '';
  if (isEmpty) {
    return '';
  }

  var isNonNumeric = isNaN(value);
  if (isNonNumeric || value === 0 || isUnitlessNumber.hasOwnProperty(name) && isUnitlessNumber[name]) {
    return '' + value; // cast to string
  }

  if (typeof value === 'string') {
    value = value.trim();
  }
  return value + 'px';
}

module.exports = dangerousStyleValue;
},{"./CSSProperty":59}],162:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule deprecated
 */

'use strict';

var assign = require('./Object.assign');
var warning = require('fbjs/lib/warning');

/**
 * This will log a single deprecation notice per function and forward the call
 * on to the new API.
 *
 * @param {string} fnName The name of the function
 * @param {string} newModule The module that fn will exist in
 * @param {string} newPackage The module that fn will exist in
 * @param {*} ctx The context this forwarded call should run in
 * @param {function} fn The function to forward on to
 * @return {function} The function that will warn once and then call fn
 */
function deprecated(fnName, newModule, newPackage, ctx, fn) {
  var warned = false;
  if ("production" !== 'production') {
    var newFn = function () {
      "production" !== 'production' ? warning(warned,
      // Require examples in this string must be split to prevent React's
      // build tools from mistaking them for real requires.
      // Otherwise the build tools will attempt to build a '%s' module.
      'React.%s is deprecated. Please use %s.%s from require' + '(\'%s\') ' + 'instead.', fnName, newModule, fnName, newPackage) : undefined;
      warned = true;
      return fn.apply(ctx, arguments);
    };
    // We need to make sure all properties of the original fn are copied over.
    // In particular, this is needed to support PropTypes
    return assign(newFn, fn);
  }

  return fn;
}

module.exports = deprecated;
},{"./Object.assign":78,"fbjs/lib/warning":211}],163:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule escapeTextContentForBrowser
 */

'use strict';

var ESCAPE_LOOKUP = {
  '&': '&amp;',
  '>': '&gt;',
  '<': '&lt;',
  '"': '&quot;',
  '\'': '&#x27;'
};

var ESCAPE_REGEX = /[&><"']/g;

function escaper(match) {
  return ESCAPE_LOOKUP[match];
}

/**
 * Escapes text to prevent scripting attacks.
 *
 * @param {*} text Text value to escape.
 * @return {string} An escaped string.
 */
function escapeTextContentForBrowser(text) {
  return ('' + text).replace(ESCAPE_REGEX, escaper);
}

module.exports = escapeTextContentForBrowser;
},{}],164:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule findDOMNode
 * @typechecks static-only
 */

'use strict';

var ReactCurrentOwner = require('./ReactCurrentOwner');
var ReactInstanceMap = require('./ReactInstanceMap');
var ReactMount = require('./ReactMount');

var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

/**
 * Returns the DOM node rendered by this element.
 *
 * @param {ReactComponent|DOMElement} componentOrElement
 * @return {?DOMElement} The root node of this element.
 */
function findDOMNode(componentOrElement) {
  if ("production" !== 'production') {
    var owner = ReactCurrentOwner.current;
    if (owner !== null) {
      "production" !== 'production' ? warning(owner._warnedAboutRefsInRender, '%s is accessing getDOMNode or findDOMNode inside its render(). ' + 'render() should be a pure function of props and state. It should ' + 'never access something that requires stale data from the previous ' + 'render, such as refs. Move this logic to componentDidMount and ' + 'componentDidUpdate instead.', owner.getName() || 'A component') : undefined;
      owner._warnedAboutRefsInRender = true;
    }
  }
  if (componentOrElement == null) {
    return null;
  }
  if (componentOrElement.nodeType === 1) {
    return componentOrElement;
  }
  if (ReactInstanceMap.has(componentOrElement)) {
    return ReactMount.getNodeFromInstance(componentOrElement);
  }
  !(componentOrElement.render == null || typeof componentOrElement.render !== 'function') ? "production" !== 'production' ? invariant(false, 'findDOMNode was called on an unmounted component.') : invariant(false) : undefined;
  !false ? "production" !== 'production' ? invariant(false, 'Element appears to be neither ReactComponent nor DOMNode (keys: %s)', Object.keys(componentOrElement)) : invariant(false) : undefined;
}

module.exports = findDOMNode;
},{"./ReactCurrentOwner":90,"./ReactInstanceMap":118,"./ReactMount":121,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],165:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule flattenChildren
 */

'use strict';

var traverseAllChildren = require('./traverseAllChildren');
var warning = require('fbjs/lib/warning');

/**
 * @param {function} traverseContext Context passed through traversal.
 * @param {?ReactComponent} child React child component.
 * @param {!string} name String name of key path to child.
 */
function flattenSingleChildIntoContext(traverseContext, child, name) {
  // We found a component instance.
  var result = traverseContext;
  var keyUnique = result[name] === undefined;
  if ("production" !== 'production') {
    "production" !== 'production' ? warning(keyUnique, 'flattenChildren(...): Encountered two children with the same key, ' + '`%s`. Child keys must be unique; when two children share a key, only ' + 'the first child will be used.', name) : undefined;
  }
  if (keyUnique && child != null) {
    result[name] = child;
  }
}

/**
 * Flattens children that are typically specified as `props.children`. Any null
 * children will not be included in the resulting object.
 * @return {!object} flattened children keyed by name.
 */
function flattenChildren(children) {
  if (children == null) {
    return children;
  }
  var result = {};
  traverseAllChildren(children, flattenSingleChildIntoContext, result);
  return result;
}

module.exports = flattenChildren;
},{"./traverseAllChildren":183,"fbjs/lib/warning":211}],166:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule forEachAccumulated
 */

'use strict';

/**
 * @param {array} arr an "accumulation" of items which is either an Array or
 * a single item. Useful when paired with the `accumulate` module. This is a
 * simple utility that allows us to reason about a collection of items, but
 * handling the case when there is exactly one item (and we do not need to
 * allocate an array).
 */
var forEachAccumulated = function (arr, cb, scope) {
  if (Array.isArray(arr)) {
    arr.forEach(cb, scope);
  } else if (arr) {
    cb.call(scope, arr);
  }
};

module.exports = forEachAccumulated;
},{}],167:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getEventCharCode
 * @typechecks static-only
 */

'use strict';

/**
 * `charCode` represents the actual "character code" and is safe to use with
 * `String.fromCharCode`. As such, only keys that correspond to printable
 * characters produce a valid `charCode`, the only exception to this is Enter.
 * The Tab-key is considered non-printable and does not have a `charCode`,
 * presumably because it does not produce a tab-character in browsers.
 *
 * @param {object} nativeEvent Native browser event.
 * @return {number} Normalized `charCode` property.
 */
function getEventCharCode(nativeEvent) {
  var charCode;
  var keyCode = nativeEvent.keyCode;

  if ('charCode' in nativeEvent) {
    charCode = nativeEvent.charCode;

    // FF does not set `charCode` for the Enter-key, check against `keyCode`.
    if (charCode === 0 && keyCode === 13) {
      charCode = 13;
    }
  } else {
    // IE8 does not implement `charCode`, but `keyCode` has the correct value.
    charCode = keyCode;
  }

  // Some non-printable keys are reported in `charCode`/`keyCode`, discard them.
  // Must not discard the (non-)printable Enter-key.
  if (charCode >= 32 || charCode === 13) {
    return charCode;
  }

  return 0;
}

module.exports = getEventCharCode;
},{}],168:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getEventKey
 * @typechecks static-only
 */

'use strict';

var getEventCharCode = require('./getEventCharCode');

/**
 * Normalization of deprecated HTML5 `key` values
 * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent#Key_names
 */
var normalizeKey = {
  'Esc': 'Escape',
  'Spacebar': ' ',
  'Left': 'ArrowLeft',
  'Up': 'ArrowUp',
  'Right': 'ArrowRight',
  'Down': 'ArrowDown',
  'Del': 'Delete',
  'Win': 'OS',
  'Menu': 'ContextMenu',
  'Apps': 'ContextMenu',
  'Scroll': 'ScrollLock',
  'MozPrintableKey': 'Unidentified'
};

/**
 * Translation from legacy `keyCode` to HTML5 `key`
 * Only special keys supported, all others depend on keyboard layout or browser
 * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent#Key_names
 */
var translateToKey = {
  8: 'Backspace',
  9: 'Tab',
  12: 'Clear',
  13: 'Enter',
  16: 'Shift',
  17: 'Control',
  18: 'Alt',
  19: 'Pause',
  20: 'CapsLock',
  27: 'Escape',
  32: ' ',
  33: 'PageUp',
  34: 'PageDown',
  35: 'End',
  36: 'Home',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  45: 'Insert',
  46: 'Delete',
  112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
  118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
  144: 'NumLock',
  145: 'ScrollLock',
  224: 'Meta'
};

/**
 * @param {object} nativeEvent Native browser event.
 * @return {string} Normalized `key` property.
 */
function getEventKey(nativeEvent) {
  if (nativeEvent.key) {
    // Normalize inconsistent values reported by browsers due to
    // implementations of a working draft specification.

    // FireFox implements `key` but returns `MozPrintableKey` for all
    // printable characters (normalized to `Unidentified`), ignore it.
    var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
    if (key !== 'Unidentified') {
      return key;
    }
  }

  // Browser does not implement `key`, polyfill as much of it as we can.
  if (nativeEvent.type === 'keypress') {
    var charCode = getEventCharCode(nativeEvent);

    // The enter-key is technically both printable and non-printable and can
    // thus be captured by `keypress`, no other non-printable key should.
    return charCode === 13 ? 'Enter' : String.fromCharCode(charCode);
  }
  if (nativeEvent.type === 'keydown' || nativeEvent.type === 'keyup') {
    // While user keyboard layout determines the actual meaning of each
    // `keyCode` value, almost all function keys have a universal value.
    return translateToKey[nativeEvent.keyCode] || 'Unidentified';
  }
  return '';
}

module.exports = getEventKey;
},{"./getEventCharCode":167}],169:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getEventModifierState
 * @typechecks static-only
 */

'use strict';

/**
 * Translation from modifier key to the associated property in the event.
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#keys-Modifiers
 */

var modifierKeyToProp = {
  'Alt': 'altKey',
  'Control': 'ctrlKey',
  'Meta': 'metaKey',
  'Shift': 'shiftKey'
};

// IE8 does not implement getModifierState so we simply map it to the only
// modifier keys exposed by the event itself, does not support Lock-keys.
// Currently, all major browsers except Chrome seems to support Lock-keys.
function modifierStateGetter(keyArg) {
  var syntheticEvent = this;
  var nativeEvent = syntheticEvent.nativeEvent;
  if (nativeEvent.getModifierState) {
    return nativeEvent.getModifierState(keyArg);
  }
  var keyProp = modifierKeyToProp[keyArg];
  return keyProp ? !!nativeEvent[keyProp] : false;
}

function getEventModifierState(nativeEvent) {
  return modifierStateGetter;
}

module.exports = getEventModifierState;
},{}],170:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getEventTarget
 * @typechecks static-only
 */

'use strict';

/**
 * Gets the target node from a native browser event by accounting for
 * inconsistencies in browser DOM APIs.
 *
 * @param {object} nativeEvent Native browser event.
 * @return {DOMEventTarget} Target node.
 */
function getEventTarget(nativeEvent) {
  var target = nativeEvent.target || nativeEvent.srcElement || window;
  // Safari may fire events on text nodes (Node.TEXT_NODE is 3).
  // @see http://www.quirksmode.org/js/events_properties.html
  return target.nodeType === 3 ? target.parentNode : target;
}

module.exports = getEventTarget;
},{}],171:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getIteratorFn
 * @typechecks static-only
 */

'use strict';

/* global Symbol */
var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

/**
 * Returns the iterator method function contained on the iterable object.
 *
 * Be sure to invoke the function with the iterable as context:
 *
 *     var iteratorFn = getIteratorFn(myIterable);
 *     if (iteratorFn) {
 *       var iterator = iteratorFn.call(myIterable);
 *       ...
 *     }
 *
 * @param {?object} maybeIterable
 * @return {?function}
 */
function getIteratorFn(maybeIterable) {
  var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
  if (typeof iteratorFn === 'function') {
    return iteratorFn;
  }
}

module.exports = getIteratorFn;
},{}],172:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getNodeForCharacterOffset
 */

'use strict';

/**
 * Given any node return the first leaf node without children.
 *
 * @param {DOMElement|DOMTextNode} node
 * @return {DOMElement|DOMTextNode}
 */
function getLeafNode(node) {
  while (node && node.firstChild) {
    node = node.firstChild;
  }
  return node;
}

/**
 * Get the next sibling within a container. This will walk up the
 * DOM if a node's siblings have been exhausted.
 *
 * @param {DOMElement|DOMTextNode} node
 * @return {?DOMElement|DOMTextNode}
 */
function getSiblingNode(node) {
  while (node) {
    if (node.nextSibling) {
      return node.nextSibling;
    }
    node = node.parentNode;
  }
}

/**
 * Get object describing the nodes which contain characters at offset.
 *
 * @param {DOMElement|DOMTextNode} root
 * @param {number} offset
 * @return {?object}
 */
function getNodeForCharacterOffset(root, offset) {
  var node = getLeafNode(root);
  var nodeStart = 0;
  var nodeEnd = 0;

  while (node) {
    if (node.nodeType === 3) {
      nodeEnd = nodeStart + node.textContent.length;

      if (nodeStart <= offset && nodeEnd >= offset) {
        return {
          node: node,
          offset: offset - nodeStart
        };
      }

      nodeStart = nodeEnd;
    }

    node = getLeafNode(getSiblingNode(node));
  }
}

module.exports = getNodeForCharacterOffset;
},{}],173:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getTextContentAccessor
 */

'use strict';

var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');

var contentKey = null;

/**
 * Gets the key used to access text content on a DOM node.
 *
 * @return {?string} Key used to access text content.
 * @internal
 */
function getTextContentAccessor() {
  if (!contentKey && ExecutionEnvironment.canUseDOM) {
    // Prefer textContent to innerText because many browsers support both but
    // SVG <text> elements don't support innerText even when <div> does.
    contentKey = 'textContent' in document.documentElement ? 'textContent' : 'innerText';
  }
  return contentKey;
}

module.exports = getTextContentAccessor;
},{"fbjs/lib/ExecutionEnvironment":186}],174:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule instantiateReactComponent
 * @typechecks static-only
 */

'use strict';

var ReactCompositeComponent = require('./ReactCompositeComponent');
var ReactEmptyComponent = require('./ReactEmptyComponent');
var ReactNativeComponent = require('./ReactNativeComponent');

var assign = require('./Object.assign');
var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

// To avoid a cyclic dependency, we create the final class in this module
var ReactCompositeComponentWrapper = function () {};
assign(ReactCompositeComponentWrapper.prototype, ReactCompositeComponent.Mixin, {
  _instantiateReactComponent: instantiateReactComponent
});

function getDeclarationErrorAddendum(owner) {
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

/**
 * Check if the type reference is a known internal type. I.e. not a user
 * provided composite type.
 *
 * @param {function} type
 * @return {boolean} Returns true if this is a valid internal type.
 */
function isInternalComponentType(type) {
  return typeof type === 'function' && typeof type.prototype !== 'undefined' && typeof type.prototype.mountComponent === 'function' && typeof type.prototype.receiveComponent === 'function';
}

/**
 * Given a ReactNode, create an instance that will actually be mounted.
 *
 * @param {ReactNode} node
 * @return {object} A new instance of the element's constructor.
 * @protected
 */
function instantiateReactComponent(node) {
  var instance;

  if (node === null || node === false) {
    instance = new ReactEmptyComponent(instantiateReactComponent);
  } else if (typeof node === 'object') {
    var element = node;
    !(element && (typeof element.type === 'function' || typeof element.type === 'string')) ? "production" !== 'production' ? invariant(false, 'Element type is invalid: expected a string (for built-in components) ' + 'or a class/function (for composite components) but got: %s.%s', element.type == null ? element.type : typeof element.type, getDeclarationErrorAddendum(element._owner)) : invariant(false) : undefined;

    // Special case string values
    if (typeof element.type === 'string') {
      instance = ReactNativeComponent.createInternalComponent(element);
    } else if (isInternalComponentType(element.type)) {
      // This is temporarily available for custom components that are not string
      // representations. I.e. ART. Once those are updated to use the string
      // representation, we can drop this code path.
      instance = new element.type(element);
    } else {
      instance = new ReactCompositeComponentWrapper();
    }
  } else if (typeof node === 'string' || typeof node === 'number') {
    instance = ReactNativeComponent.createInstanceForText(node);
  } else {
    !false ? "production" !== 'production' ? invariant(false, 'Encountered invalid React node of type %s', typeof node) : invariant(false) : undefined;
  }

  if ("production" !== 'production') {
    "production" !== 'production' ? warning(typeof instance.construct === 'function' && typeof instance.mountComponent === 'function' && typeof instance.receiveComponent === 'function' && typeof instance.unmountComponent === 'function', 'Only React Components can be mounted.') : undefined;
  }

  // Sets up the instance. This can probably just move into the constructor now.
  instance.construct(node);

  // These two fields are used by the DOM and ART diffing algorithms
  // respectively. Instead of using expandos on components, we should be
  // storing the state needed by the diffing algorithms elsewhere.
  instance._mountIndex = 0;
  instance._mountImage = null;

  if ("production" !== 'production') {
    instance._isOwnerNecessary = false;
    instance._warnedAboutRefsInRender = false;
  }

  // Internal instances should fully constructed at this point, so they should
  // not get any new fields added to them at this point.
  if ("production" !== 'production') {
    if (Object.preventExtensions) {
      Object.preventExtensions(instance);
    }
  }

  return instance;
}

module.exports = instantiateReactComponent;
},{"./Object.assign":78,"./ReactCompositeComponent":89,"./ReactEmptyComponent":110,"./ReactNativeComponent":124,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],175:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isEventSupported
 */

'use strict';

var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');

var useHasFeature;
if (ExecutionEnvironment.canUseDOM) {
  useHasFeature = document.implementation && document.implementation.hasFeature &&
  // always returns true in newer browsers as per the standard.
  // @see http://dom.spec.whatwg.org/#dom-domimplementation-hasfeature
  document.implementation.hasFeature('', '') !== true;
}

/**
 * Checks if an event is supported in the current execution environment.
 *
 * NOTE: This will not work correctly for non-generic events such as `change`,
 * `reset`, `load`, `error`, and `select`.
 *
 * Borrows from Modernizr.
 *
 * @param {string} eventNameSuffix Event name, e.g. "click".
 * @param {?boolean} capture Check if the capture phase is supported.
 * @return {boolean} True if the event is supported.
 * @internal
 * @license Modernizr 3.0.0pre (Custom Build) | MIT
 */
function isEventSupported(eventNameSuffix, capture) {
  if (!ExecutionEnvironment.canUseDOM || capture && !('addEventListener' in document)) {
    return false;
  }

  var eventName = 'on' + eventNameSuffix;
  var isSupported = (eventName in document);

  if (!isSupported) {
    var element = document.createElement('div');
    element.setAttribute(eventName, 'return;');
    isSupported = typeof element[eventName] === 'function';
  }

  if (!isSupported && useHasFeature && eventNameSuffix === 'wheel') {
    // This is the only way to test support for the `wheel` event in IE9+.
    isSupported = document.implementation.hasFeature('Events.wheel', '3.0');
  }

  return isSupported;
}

module.exports = isEventSupported;
},{"fbjs/lib/ExecutionEnvironment":186}],176:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isTextInputElement
 */

'use strict';

/**
 * @see http://www.whatwg.org/specs/web-apps/current-work/multipage/the-input-element.html#input-type-attr-summary
 */
var supportedInputTypes = {
  'color': true,
  'date': true,
  'datetime': true,
  'datetime-local': true,
  'email': true,
  'month': true,
  'number': true,
  'password': true,
  'range': true,
  'search': true,
  'tel': true,
  'text': true,
  'time': true,
  'url': true,
  'week': true
};

function isTextInputElement(elem) {
  var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
  return nodeName && (nodeName === 'input' && supportedInputTypes[elem.type] || nodeName === 'textarea');
}

module.exports = isTextInputElement;
},{}],177:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule onlyChild
 */
'use strict';

var ReactElement = require('./ReactElement');

var invariant = require('fbjs/lib/invariant');

/**
 * Returns the first child in a collection of children and verifies that there
 * is only one child in the collection. The current implementation of this
 * function assumes that a single child gets passed without a wrapper, but the
 * purpose of this helper function is to abstract away the particular structure
 * of children.
 *
 * @param {?object} children Child collection structure.
 * @return {ReactComponent} The first and only `ReactComponent` contained in the
 * structure.
 */
function onlyChild(children) {
  !ReactElement.isValidElement(children) ? "production" !== 'production' ? invariant(false, 'onlyChild must be passed a children with exactly one child.') : invariant(false) : undefined;
  return children;
}

module.exports = onlyChild;
},{"./ReactElement":108,"fbjs/lib/invariant":200}],178:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule quoteAttributeValueForBrowser
 */

'use strict';

var escapeTextContentForBrowser = require('./escapeTextContentForBrowser');

/**
 * Escapes attribute value to prevent scripting attacks.
 *
 * @param {*} value Value to escape.
 * @return {string} An escaped string.
 */
function quoteAttributeValueForBrowser(value) {
  return '"' + escapeTextContentForBrowser(value) + '"';
}

module.exports = quoteAttributeValueForBrowser;
},{"./escapeTextContentForBrowser":163}],179:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
* @providesModule renderSubtreeIntoContainer
*/

'use strict';

var ReactMount = require('./ReactMount');

module.exports = ReactMount.renderSubtreeIntoContainer;
},{"./ReactMount":121}],180:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule setInnerHTML
 */

/* globals MSApp */

'use strict';

var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');

var WHITESPACE_TEST = /^[ \r\n\t\f]/;
var NONVISIBLE_TEST = /<(!--|link|noscript|meta|script|style)[ \r\n\t\f\/>]/;

/**
 * Set the innerHTML property of a node, ensuring that whitespace is preserved
 * even in IE8.
 *
 * @param {DOMElement} node
 * @param {string} html
 * @internal
 */
var setInnerHTML = function (node, html) {
  node.innerHTML = html;
};

// Win8 apps: Allow all html to be inserted
if (typeof MSApp !== 'undefined' && MSApp.execUnsafeLocalFunction) {
  setInnerHTML = function (node, html) {
    MSApp.execUnsafeLocalFunction(function () {
      node.innerHTML = html;
    });
  };
}

if (ExecutionEnvironment.canUseDOM) {
  // IE8: When updating a just created node with innerHTML only leading
  // whitespace is removed. When updating an existing node with innerHTML
  // whitespace in root TextNodes is also collapsed.
  // @see quirksmode.org/bugreports/archives/2004/11/innerhtml_and_t.html

  // Feature detection; only IE8 is known to behave improperly like this.
  var testElement = document.createElement('div');
  testElement.innerHTML = ' ';
  if (testElement.innerHTML === '') {
    setInnerHTML = function (node, html) {
      // Magic theory: IE8 supposedly differentiates between added and updated
      // nodes when processing innerHTML, innerHTML on updated nodes suffers
      // from worse whitespace behavior. Re-adding a node like this triggers
      // the initial and more favorable whitespace behavior.
      // TODO: What to do on a detached node?
      if (node.parentNode) {
        node.parentNode.replaceChild(node, node);
      }

      // We also implement a workaround for non-visible tags disappearing into
      // thin air on IE8, this only happens if there is no visible text
      // in-front of the non-visible tags. Piggyback on the whitespace fix
      // and simply check if any non-visible tags appear in the source.
      if (WHITESPACE_TEST.test(html) || html[0] === '<' && NONVISIBLE_TEST.test(html)) {
        // Recover leading whitespace by temporarily prepending any character.
        // \uFEFF has the potential advantage of being zero-width/invisible.
        // UglifyJS drops U+FEFF chars when parsing, so use String.fromCharCode
        // in hopes that this is preserved even if "\uFEFF" is transformed to
        // the actual Unicode character (by Babel, for example).
        // https://github.com/mishoo/UglifyJS2/blob/v2.4.20/lib/parse.js#L216
        node.innerHTML = String.fromCharCode(0xFEFF) + html;

        // deleteData leaves an empty `TextNode` which offsets the index of all
        // children. Definitely want to avoid this.
        var textNode = node.firstChild;
        if (textNode.data.length === 1) {
          node.removeChild(textNode);
        } else {
          textNode.deleteData(0, 1);
        }
      } else {
        node.innerHTML = html;
      }
    };
  }
}

module.exports = setInnerHTML;
},{"fbjs/lib/ExecutionEnvironment":186}],181:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule setTextContent
 */

'use strict';

var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');
var escapeTextContentForBrowser = require('./escapeTextContentForBrowser');
var setInnerHTML = require('./setInnerHTML');

/**
 * Set the textContent property of a node, ensuring that whitespace is preserved
 * even in IE8. innerText is a poor substitute for textContent and, among many
 * issues, inserts <br> instead of the literal newline chars. innerHTML behaves
 * as it should.
 *
 * @param {DOMElement} node
 * @param {string} text
 * @internal
 */
var setTextContent = function (node, text) {
  node.textContent = text;
};

if (ExecutionEnvironment.canUseDOM) {
  if (!('textContent' in document.documentElement)) {
    setTextContent = function (node, text) {
      setInnerHTML(node, escapeTextContentForBrowser(text));
    };
  }
}

module.exports = setTextContent;
},{"./escapeTextContentForBrowser":163,"./setInnerHTML":180,"fbjs/lib/ExecutionEnvironment":186}],182:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule shouldUpdateReactComponent
 * @typechecks static-only
 */

'use strict';

/**
 * Given a `prevElement` and `nextElement`, determines if the existing
 * instance should be updated as opposed to being destroyed or replaced by a new
 * instance. Both arguments are elements. This ensures that this logic can
 * operate on stateless trees without any backing instance.
 *
 * @param {?object} prevElement
 * @param {?object} nextElement
 * @return {boolean} True if the existing instance should be updated.
 * @protected
 */
function shouldUpdateReactComponent(prevElement, nextElement) {
  var prevEmpty = prevElement === null || prevElement === false;
  var nextEmpty = nextElement === null || nextElement === false;
  if (prevEmpty || nextEmpty) {
    return prevEmpty === nextEmpty;
  }

  var prevType = typeof prevElement;
  var nextType = typeof nextElement;
  if (prevType === 'string' || prevType === 'number') {
    return nextType === 'string' || nextType === 'number';
  } else {
    return nextType === 'object' && prevElement.type === nextElement.type && prevElement.key === nextElement.key;
  }
  return false;
}

module.exports = shouldUpdateReactComponent;
},{}],183:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule traverseAllChildren
 */

'use strict';

var ReactCurrentOwner = require('./ReactCurrentOwner');
var ReactElement = require('./ReactElement');
var ReactInstanceHandles = require('./ReactInstanceHandles');

var getIteratorFn = require('./getIteratorFn');
var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

var SEPARATOR = ReactInstanceHandles.SEPARATOR;
var SUBSEPARATOR = ':';

/**
 * TODO: Test that a single child and an array with one item have the same key
 * pattern.
 */

var userProvidedKeyEscaperLookup = {
  '=': '=0',
  '.': '=1',
  ':': '=2'
};

var userProvidedKeyEscapeRegex = /[=.:]/g;

var didWarnAboutMaps = false;

function userProvidedKeyEscaper(match) {
  return userProvidedKeyEscaperLookup[match];
}

/**
 * Generate a key string that identifies a component within a set.
 *
 * @param {*} component A component that could contain a manual key.
 * @param {number} index Index that is used if a manual key is not provided.
 * @return {string}
 */
function getComponentKey(component, index) {
  if (component && component.key != null) {
    // Explicit key
    return wrapUserProvidedKey(component.key);
  }
  // Implicit key determined by the index in the set
  return index.toString(36);
}

/**
 * Escape a component key so that it is safe to use in a reactid.
 *
 * @param {*} text Component key to be escaped.
 * @return {string} An escaped string.
 */
function escapeUserProvidedKey(text) {
  return ('' + text).replace(userProvidedKeyEscapeRegex, userProvidedKeyEscaper);
}

/**
 * Wrap a `key` value explicitly provided by the user to distinguish it from
 * implicitly-generated keys generated by a component's index in its parent.
 *
 * @param {string} key Value of a user-provided `key` attribute
 * @return {string}
 */
function wrapUserProvidedKey(key) {
  return '$' + escapeUserProvidedKey(key);
}

/**
 * @param {?*} children Children tree container.
 * @param {!string} nameSoFar Name of the key path so far.
 * @param {!function} callback Callback to invoke with each child found.
 * @param {?*} traverseContext Used to pass information throughout the traversal
 * process.
 * @return {!number} The number of children in this subtree.
 */
function traverseAllChildrenImpl(children, nameSoFar, callback, traverseContext) {
  var type = typeof children;

  if (type === 'undefined' || type === 'boolean') {
    // All of the above are perceived as null.
    children = null;
  }

  if (children === null || type === 'string' || type === 'number' || ReactElement.isValidElement(children)) {
    callback(traverseContext, children,
    // If it's the only child, treat the name as if it was wrapped in an array
    // so that it's consistent if the number of children grows.
    nameSoFar === '' ? SEPARATOR + getComponentKey(children, 0) : nameSoFar);
    return 1;
  }

  var child;
  var nextName;
  var subtreeCount = 0; // Count of children found in the current subtree.
  var nextNamePrefix = nameSoFar === '' ? SEPARATOR : nameSoFar + SUBSEPARATOR;

  if (Array.isArray(children)) {
    for (var i = 0; i < children.length; i++) {
      child = children[i];
      nextName = nextNamePrefix + getComponentKey(child, i);
      subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
    }
  } else {
    var iteratorFn = getIteratorFn(children);
    if (iteratorFn) {
      var iterator = iteratorFn.call(children);
      var step;
      if (iteratorFn !== children.entries) {
        var ii = 0;
        while (!(step = iterator.next()).done) {
          child = step.value;
          nextName = nextNamePrefix + getComponentKey(child, ii++);
          subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
        }
      } else {
        if ("production" !== 'production') {
          "production" !== 'production' ? warning(didWarnAboutMaps, 'Using Maps as children is not yet fully supported. It is an ' + 'experimental feature that might be removed. Convert it to a ' + 'sequence / iterable of keyed ReactElements instead.') : undefined;
          didWarnAboutMaps = true;
        }
        // Iterator will provide entry [k,v] tuples rather than values.
        while (!(step = iterator.next()).done) {
          var entry = step.value;
          if (entry) {
            child = entry[1];
            nextName = nextNamePrefix + wrapUserProvidedKey(entry[0]) + SUBSEPARATOR + getComponentKey(child, 0);
            subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
          }
        }
      }
    } else if (type === 'object') {
      var addendum = '';
      if ("production" !== 'production') {
        addendum = ' If you meant to render a collection of children, use an array ' + 'instead or wrap the object using createFragment(object) from the ' + 'React add-ons.';
        if (children._isReactElement) {
          addendum = ' It looks like you\'re using an element created by a different ' + 'version of React. Make sure to use only one copy of React.';
        }
        if (ReactCurrentOwner.current) {
          var name = ReactCurrentOwner.current.getName();
          if (name) {
            addendum += ' Check the render method of `' + name + '`.';
          }
        }
      }
      var childrenString = String(children);
      !false ? "production" !== 'production' ? invariant(false, 'Objects are not valid as a React child (found: %s).%s', childrenString === '[object Object]' ? 'object with keys {' + Object.keys(children).join(', ') + '}' : childrenString, addendum) : invariant(false) : undefined;
    }
  }

  return subtreeCount;
}

/**
 * Traverses children that are typically specified as `props.children`, but
 * might also be specified through attributes:
 *
 * - `traverseAllChildren(this.props.children, ...)`
 * - `traverseAllChildren(this.props.leftPanelChildren, ...)`
 *
 * The `traverseContext` is an optional argument that is passed through the
 * entire traversal. It can be used to store accumulations or anything else that
 * the callback might find relevant.
 *
 * @param {?*} children Children tree object.
 * @param {!function} callback To invoke upon traversing each child.
 * @param {?*} traverseContext Context for traversal.
 * @return {!number} The number of children in this subtree.
 */
function traverseAllChildren(children, callback, traverseContext) {
  if (children == null) {
    return 0;
  }

  return traverseAllChildrenImpl(children, '', callback, traverseContext);
}

module.exports = traverseAllChildren;
},{"./ReactCurrentOwner":90,"./ReactElement":108,"./ReactInstanceHandles":117,"./getIteratorFn":171,"fbjs/lib/invariant":200,"fbjs/lib/warning":211}],184:[function(require,module,exports){
/**
 * Copyright 2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule validateDOMNesting
 */

'use strict';

var assign = require('./Object.assign');
var emptyFunction = require('fbjs/lib/emptyFunction');
var warning = require('fbjs/lib/warning');

var validateDOMNesting = emptyFunction;

if ("production" !== 'production') {
  // This validation code was written based on the HTML5 parsing spec:
  // https://html.spec.whatwg.org/multipage/syntax.html#has-an-element-in-scope
  //
  // Note: this does not catch all invalid nesting, nor does it try to (as it's
  // not clear what practical benefit doing so provides); instead, we warn only
  // for cases where the parser will give a parse tree differing from what React
  // intended. For example, <b><div></div></b> is invalid but we don't warn
  // because it still parses correctly; we do warn for other cases like nested
  // <p> tags where the beginning of the second element implicitly closes the
  // first, causing a confusing mess.

  // https://html.spec.whatwg.org/multipage/syntax.html#special
  var specialTags = ['address', 'applet', 'area', 'article', 'aside', 'base', 'basefont', 'bgsound', 'blockquote', 'body', 'br', 'button', 'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dir', 'div', 'dl', 'dt', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'iframe', 'img', 'input', 'isindex', 'li', 'link', 'listing', 'main', 'marquee', 'menu', 'menuitem', 'meta', 'nav', 'noembed', 'noframes', 'noscript', 'object', 'ol', 'p', 'param', 'plaintext', 'pre', 'script', 'section', 'select', 'source', 'style', 'summary', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul', 'wbr', 'xmp'];

  // https://html.spec.whatwg.org/multipage/syntax.html#has-an-element-in-scope
  var inScopeTags = ['applet', 'caption', 'html', 'table', 'td', 'th', 'marquee', 'object', 'template',

  // https://html.spec.whatwg.org/multipage/syntax.html#html-integration-point
  // TODO: Distinguish by namespace here -- for <title>, including it here
  // errs on the side of fewer warnings
  'foreignObject', 'desc', 'title'];

  // https://html.spec.whatwg.org/multipage/syntax.html#has-an-element-in-button-scope
  var buttonScopeTags = inScopeTags.concat(['button']);

  // https://html.spec.whatwg.org/multipage/syntax.html#generate-implied-end-tags
  var impliedEndTags = ['dd', 'dt', 'li', 'option', 'optgroup', 'p', 'rp', 'rt'];

  var emptyAncestorInfo = {
    parentTag: null,

    formTag: null,
    aTagInScope: null,
    buttonTagInScope: null,
    nobrTagInScope: null,
    pTagInButtonScope: null,

    listItemTagAutoclosing: null,
    dlItemTagAutoclosing: null
  };

  var updatedAncestorInfo = function (oldInfo, tag, instance) {
    var ancestorInfo = assign({}, oldInfo || emptyAncestorInfo);
    var info = { tag: tag, instance: instance };

    if (inScopeTags.indexOf(tag) !== -1) {
      ancestorInfo.aTagInScope = null;
      ancestorInfo.buttonTagInScope = null;
      ancestorInfo.nobrTagInScope = null;
    }
    if (buttonScopeTags.indexOf(tag) !== -1) {
      ancestorInfo.pTagInButtonScope = null;
    }

    // See rules for 'li', 'dd', 'dt' start tags in
    // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-inbody
    if (specialTags.indexOf(tag) !== -1 && tag !== 'address' && tag !== 'div' && tag !== 'p') {
      ancestorInfo.listItemTagAutoclosing = null;
      ancestorInfo.dlItemTagAutoclosing = null;
    }

    ancestorInfo.parentTag = info;

    if (tag === 'form') {
      ancestorInfo.formTag = info;
    }
    if (tag === 'a') {
      ancestorInfo.aTagInScope = info;
    }
    if (tag === 'button') {
      ancestorInfo.buttonTagInScope = info;
    }
    if (tag === 'nobr') {
      ancestorInfo.nobrTagInScope = info;
    }
    if (tag === 'p') {
      ancestorInfo.pTagInButtonScope = info;
    }
    if (tag === 'li') {
      ancestorInfo.listItemTagAutoclosing = info;
    }
    if (tag === 'dd' || tag === 'dt') {
      ancestorInfo.dlItemTagAutoclosing = info;
    }

    return ancestorInfo;
  };

  /**
   * Returns whether
   */
  var isTagValidWithParent = function (tag, parentTag) {
    // First, let's check if we're in an unusual parsing mode...
    switch (parentTag) {
      // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-inselect
      case 'select':
        return tag === 'option' || tag === 'optgroup' || tag === '#text';
      case 'optgroup':
        return tag === 'option' || tag === '#text';
      // Strictly speaking, seeing an <option> doesn't mean we're in a <select>
      // but
      case 'option':
        return tag === '#text';

      // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-intd
      // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-incaption
      // No special behavior since these rules fall back to "in body" mode for
      // all except special table nodes which cause bad parsing behavior anyway.

      // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-intr
      case 'tr':
        return tag === 'th' || tag === 'td' || tag === 'style' || tag === 'script' || tag === 'template';

      // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-intbody
      case 'tbody':
      case 'thead':
      case 'tfoot':
        return tag === 'tr' || tag === 'style' || tag === 'script' || tag === 'template';

      // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-incolgroup
      case 'colgroup':
        return tag === 'col' || tag === 'template';

      // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-intable
      case 'table':
        return tag === 'caption' || tag === 'colgroup' || tag === 'tbody' || tag === 'tfoot' || tag === 'thead' || tag === 'style' || tag === 'script' || tag === 'template';

      // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-inhead
      case 'head':
        return tag === 'base' || tag === 'basefont' || tag === 'bgsound' || tag === 'link' || tag === 'meta' || tag === 'title' || tag === 'noscript' || tag === 'noframes' || tag === 'style' || tag === 'script' || tag === 'template';

      // https://html.spec.whatwg.org/multipage/semantics.html#the-html-element
      case 'html':
        return tag === 'head' || tag === 'body';
    }

    // Probably in the "in body" parsing mode, so we outlaw only tag combos
    // where the parsing rules cause implicit opens or closes to be added.
    // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-inbody
    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return parentTag !== 'h1' && parentTag !== 'h2' && parentTag !== 'h3' && parentTag !== 'h4' && parentTag !== 'h5' && parentTag !== 'h6';

      case 'rp':
      case 'rt':
        return impliedEndTags.indexOf(parentTag) === -1;

      case 'caption':
      case 'col':
      case 'colgroup':
      case 'frame':
      case 'head':
      case 'tbody':
      case 'td':
      case 'tfoot':
      case 'th':
      case 'thead':
      case 'tr':
        // These tags are only valid with a few parents that have special child
        // parsing rules -- if we're down here, then none of those matched and
        // so we allow it only if we don't know what the parent is, as all other
        // cases are invalid.
        return parentTag == null;
    }

    return true;
  };

  /**
   * Returns whether
   */
  var findInvalidAncestorForTag = function (tag, ancestorInfo) {
    switch (tag) {
      case 'address':
      case 'article':
      case 'aside':
      case 'blockquote':
      case 'center':
      case 'details':
      case 'dialog':
      case 'dir':
      case 'div':
      case 'dl':
      case 'fieldset':
      case 'figcaption':
      case 'figure':
      case 'footer':
      case 'header':
      case 'hgroup':
      case 'main':
      case 'menu':
      case 'nav':
      case 'ol':
      case 'p':
      case 'section':
      case 'summary':
      case 'ul':

      case 'pre':
      case 'listing':

      case 'table':

      case 'hr':

      case 'xmp':

      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return ancestorInfo.pTagInButtonScope;

      case 'form':
        return ancestorInfo.formTag || ancestorInfo.pTagInButtonScope;

      case 'li':
        return ancestorInfo.listItemTagAutoclosing;

      case 'dd':
      case 'dt':
        return ancestorInfo.dlItemTagAutoclosing;

      case 'button':
        return ancestorInfo.buttonTagInScope;

      case 'a':
        // Spec says something about storing a list of markers, but it sounds
        // equivalent to this check.
        return ancestorInfo.aTagInScope;

      case 'nobr':
        return ancestorInfo.nobrTagInScope;
    }

    return null;
  };

  /**
   * Given a ReactCompositeComponent instance, return a list of its recursive
   * owners, starting at the root and ending with the instance itself.
   */
  var findOwnerStack = function (instance) {
    if (!instance) {
      return [];
    }

    var stack = [];
    /*eslint-disable space-after-keywords */
    do {
      /*eslint-enable space-after-keywords */
      stack.push(instance);
    } while (instance = instance._currentElement._owner);
    stack.reverse();
    return stack;
  };

  var didWarn = {};

  validateDOMNesting = function (childTag, childInstance, ancestorInfo) {
    ancestorInfo = ancestorInfo || emptyAncestorInfo;
    var parentInfo = ancestorInfo.parentTag;
    var parentTag = parentInfo && parentInfo.tag;

    var invalidParent = isTagValidWithParent(childTag, parentTag) ? null : parentInfo;
    var invalidAncestor = invalidParent ? null : findInvalidAncestorForTag(childTag, ancestorInfo);
    var problematic = invalidParent || invalidAncestor;

    if (problematic) {
      var ancestorTag = problematic.tag;
      var ancestorInstance = problematic.instance;

      var childOwner = childInstance && childInstance._currentElement._owner;
      var ancestorOwner = ancestorInstance && ancestorInstance._currentElement._owner;

      var childOwners = findOwnerStack(childOwner);
      var ancestorOwners = findOwnerStack(ancestorOwner);

      var minStackLen = Math.min(childOwners.length, ancestorOwners.length);
      var i;

      var deepestCommon = -1;
      for (i = 0; i < minStackLen; i++) {
        if (childOwners[i] === ancestorOwners[i]) {
          deepestCommon = i;
        } else {
          break;
        }
      }

      var UNKNOWN = '(unknown)';
      var childOwnerNames = childOwners.slice(deepestCommon + 1).map(function (inst) {
        return inst.getName() || UNKNOWN;
      });
      var ancestorOwnerNames = ancestorOwners.slice(deepestCommon + 1).map(function (inst) {
        return inst.getName() || UNKNOWN;
      });
      var ownerInfo = [].concat(
      // If the parent and child instances have a common owner ancestor, start
      // with that -- otherwise we just start with the parent's owners.
      deepestCommon !== -1 ? childOwners[deepestCommon].getName() || UNKNOWN : [], ancestorOwnerNames, ancestorTag,
      // If we're warning about an invalid (non-parent) ancestry, add '...'
      invalidAncestor ? ['...'] : [], childOwnerNames, childTag).join(' > ');

      var warnKey = !!invalidParent + '|' + childTag + '|' + ancestorTag + '|' + ownerInfo;
      if (didWarn[warnKey]) {
        return;
      }
      didWarn[warnKey] = true;

      if (invalidParent) {
        var info = '';
        if (ancestorTag === 'table' && childTag === 'tr') {
          info += ' Add a <tbody> to your code to match the DOM tree generated by ' + 'the browser.';
        }
        "production" !== 'production' ? warning(false, 'validateDOMNesting(...): <%s> cannot appear as a child of <%s>. ' + 'See %s.%s', childTag, ancestorTag, ownerInfo, info) : undefined;
      } else {
        "production" !== 'production' ? warning(false, 'validateDOMNesting(...): <%s> cannot appear as a descendant of ' + '<%s>. See %s.', childTag, ancestorTag, ownerInfo) : undefined;
      }
    }
  };

  validateDOMNesting.ancestorInfoContextKey = '__validateDOMNesting_ancestorInfo$' + Math.random().toString(36).slice(2);

  validateDOMNesting.updatedAncestorInfo = updatedAncestorInfo;

  // For testing
  validateDOMNesting.isTagValidInContext = function (tag, ancestorInfo) {
    ancestorInfo = ancestorInfo || emptyAncestorInfo;
    var parentInfo = ancestorInfo.parentTag;
    var parentTag = parentInfo && parentInfo.tag;
    return isTagValidWithParent(tag, parentTag) && !findInvalidAncestorForTag(tag, ancestorInfo);
  };
}

module.exports = validateDOMNesting;
},{"./Object.assign":78,"fbjs/lib/emptyFunction":192,"fbjs/lib/warning":211}],185:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule EventListener
 * @typechecks
 */

'use strict';

var emptyFunction = require('./emptyFunction');

/**
 * Upstream version of event listener. Does not take into account specific
 * nature of platform.
 */
var EventListener = {
  /**
   * Listen to DOM events during the bubble phase.
   *
   * @param {DOMEventTarget} target DOM element to register listener on.
   * @param {string} eventType Event type, e.g. 'click' or 'mouseover'.
   * @param {function} callback Callback function.
   * @return {object} Object with a `remove` method.
   */
  listen: function (target, eventType, callback) {
    if (target.addEventListener) {
      target.addEventListener(eventType, callback, false);
      return {
        remove: function () {
          target.removeEventListener(eventType, callback, false);
        }
      };
    } else if (target.attachEvent) {
      target.attachEvent('on' + eventType, callback);
      return {
        remove: function () {
          target.detachEvent('on' + eventType, callback);
        }
      };
    }
  },

  /**
   * Listen to DOM events during the capture phase.
   *
   * @param {DOMEventTarget} target DOM element to register listener on.
   * @param {string} eventType Event type, e.g. 'click' or 'mouseover'.
   * @param {function} callback Callback function.
   * @return {object} Object with a `remove` method.
   */
  capture: function (target, eventType, callback) {
    if (target.addEventListener) {
      target.addEventListener(eventType, callback, true);
      return {
        remove: function () {
          target.removeEventListener(eventType, callback, true);
        }
      };
    } else {
      if ("production" !== 'production') {
        console.error('Attempted to listen to events during the capture phase on a ' + 'browser that does not support the capture phase. Your application ' + 'will not receive some events.');
      }
      return {
        remove: emptyFunction
      };
    }
  },

  registerDefault: function () {}
};

module.exports = EventListener;
},{"./emptyFunction":192}],186:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ExecutionEnvironment
 */

'use strict';

var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);

/**
 * Simple, lightweight module assisting with the detection and context of
 * Worker. Helps avoid circular dependencies and allows code to reason about
 * whether or not they are in a Worker, even if they never include the main
 * `ReactWorker` dependency.
 */
var ExecutionEnvironment = {

  canUseDOM: canUseDOM,

  canUseWorkers: typeof Worker !== 'undefined',

  canUseEventListeners: canUseDOM && !!(window.addEventListener || window.attachEvent),

  canUseViewport: canUseDOM && !!window.screen,

  isInWorker: !canUseDOM // For now, this is true - might change in the future.

};

module.exports = ExecutionEnvironment;
},{}],187:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule camelize
 * @typechecks
 */

"use strict";

var _hyphenPattern = /-(.)/g;

/**
 * Camelcases a hyphenated string, for example:
 *
 *   > camelize('background-color')
 *   < "backgroundColor"
 *
 * @param {string} string
 * @return {string}
 */
function camelize(string) {
  return string.replace(_hyphenPattern, function (_, character) {
    return character.toUpperCase();
  });
}

module.exports = camelize;
},{}],188:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule camelizeStyleName
 * @typechecks
 */

'use strict';

var camelize = require('./camelize');

var msPattern = /^-ms-/;

/**
 * Camelcases a hyphenated CSS property name, for example:
 *
 *   > camelizeStyleName('background-color')
 *   < "backgroundColor"
 *   > camelizeStyleName('-moz-transition')
 *   < "MozTransition"
 *   > camelizeStyleName('-ms-transition')
 *   < "msTransition"
 *
 * As Andi Smith suggests
 * (http://www.andismith.com/blog/2012/02/modernizr-prefixed/), an `-ms` prefix
 * is converted to lowercase `ms`.
 *
 * @param {string} string
 * @return {string}
 */
function camelizeStyleName(string) {
  return camelize(string.replace(msPattern, 'ms-'));
}

module.exports = camelizeStyleName;
},{"./camelize":187}],189:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule containsNode
 * @typechecks
 */

'use strict';

var isTextNode = require('./isTextNode');

/*eslint-disable no-bitwise */

/**
 * Checks if a given DOM node contains or is another DOM node.
 *
 * @param {?DOMNode} outerNode Outer DOM node.
 * @param {?DOMNode} innerNode Inner DOM node.
 * @return {boolean} True if `outerNode` contains or is `innerNode`.
 */
function containsNode(_x, _x2) {
  var _again = true;

  _function: while (_again) {
    var outerNode = _x,
        innerNode = _x2;
    _again = false;

    if (!outerNode || !innerNode) {
      return false;
    } else if (outerNode === innerNode) {
      return true;
    } else if (isTextNode(outerNode)) {
      return false;
    } else if (isTextNode(innerNode)) {
      _x = outerNode;
      _x2 = innerNode.parentNode;
      _again = true;
      continue _function;
    } else if (outerNode.contains) {
      return outerNode.contains(innerNode);
    } else if (outerNode.compareDocumentPosition) {
      return !!(outerNode.compareDocumentPosition(innerNode) & 16);
    } else {
      return false;
    }
  }
}

module.exports = containsNode;
},{"./isTextNode":202}],190:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule createArrayFromMixed
 * @typechecks
 */

'use strict';

var toArray = require('./toArray');

/**
 * Perform a heuristic test to determine if an object is "array-like".
 *
 *   A monk asked Joshu, a Zen master, "Has a dog Buddha nature?"
 *   Joshu replied: "Mu."
 *
 * This function determines if its argument has "array nature": it returns
 * true if the argument is an actual array, an `arguments' object, or an
 * HTMLCollection (e.g. node.childNodes or node.getElementsByTagName()).
 *
 * It will return false for other array-like objects like Filelist.
 *
 * @param {*} obj
 * @return {boolean}
 */
function hasArrayNature(obj) {
  return(
    // not null/false
    !!obj && (
    // arrays are objects, NodeLists are functions in Safari
    typeof obj == 'object' || typeof obj == 'function') &&
    // quacks like an array
    'length' in obj &&
    // not window
    !('setInterval' in obj) &&
    // no DOM node should be considered an array-like
    // a 'select' element has 'length' and 'item' properties on IE8
    typeof obj.nodeType != 'number' && (
    // a real array
    Array.isArray(obj) ||
    // arguments
    'callee' in obj ||
    // HTMLCollection/NodeList
    'item' in obj)
  );
}

/**
 * Ensure that the argument is an array by wrapping it in an array if it is not.
 * Creates a copy of the argument if it is already an array.
 *
 * This is mostly useful idiomatically:
 *
 *   var createArrayFromMixed = require('createArrayFromMixed');
 *
 *   function takesOneOrMoreThings(things) {
 *     things = createArrayFromMixed(things);
 *     ...
 *   }
 *
 * This allows you to treat `things' as an array, but accept scalars in the API.
 *
 * If you need to convert an array-like object, like `arguments`, into an array
 * use toArray instead.
 *
 * @param {*} obj
 * @return {array}
 */
function createArrayFromMixed(obj) {
  if (!hasArrayNature(obj)) {
    return [obj];
  } else if (Array.isArray(obj)) {
    return obj.slice();
  } else {
    return toArray(obj);
  }
}

module.exports = createArrayFromMixed;
},{"./toArray":210}],191:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule createNodesFromMarkup
 * @typechecks
 */

/*eslint-disable fb-www/unsafe-html*/

'use strict';

var ExecutionEnvironment = require('./ExecutionEnvironment');

var createArrayFromMixed = require('./createArrayFromMixed');
var getMarkupWrap = require('./getMarkupWrap');
var invariant = require('./invariant');

/**
 * Dummy container used to render all markup.
 */
var dummyNode = ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;

/**
 * Pattern used by `getNodeName`.
 */
var nodeNamePattern = /^\s*<(\w+)/;

/**
 * Extracts the `nodeName` of the first element in a string of markup.
 *
 * @param {string} markup String of markup.
 * @return {?string} Node name of the supplied markup.
 */
function getNodeName(markup) {
  var nodeNameMatch = markup.match(nodeNamePattern);
  return nodeNameMatch && nodeNameMatch[1].toLowerCase();
}

/**
 * Creates an array containing the nodes rendered from the supplied markup. The
 * optionally supplied `handleScript` function will be invoked once for each
 * <script> element that is rendered. If no `handleScript` function is supplied,
 * an exception is thrown if any <script> elements are rendered.
 *
 * @param {string} markup A string of valid HTML markup.
 * @param {?function} handleScript Invoked once for each rendered <script>.
 * @return {array<DOMElement|DOMTextNode>} An array of rendered nodes.
 */
function createNodesFromMarkup(markup, handleScript) {
  var node = dummyNode;
  !!!dummyNode ? "production" !== 'production' ? invariant(false, 'createNodesFromMarkup dummy not initialized') : invariant(false) : undefined;
  var nodeName = getNodeName(markup);

  var wrap = nodeName && getMarkupWrap(nodeName);
  if (wrap) {
    node.innerHTML = wrap[1] + markup + wrap[2];

    var wrapDepth = wrap[0];
    while (wrapDepth--) {
      node = node.lastChild;
    }
  } else {
    node.innerHTML = markup;
  }

  var scripts = node.getElementsByTagName('script');
  if (scripts.length) {
    !handleScript ? "production" !== 'production' ? invariant(false, 'createNodesFromMarkup(...): Unexpected <script> element rendered.') : invariant(false) : undefined;
    createArrayFromMixed(scripts).forEach(handleScript);
  }

  var nodes = createArrayFromMixed(node.childNodes);
  while (node.lastChild) {
    node.removeChild(node.lastChild);
  }
  return nodes;
}

module.exports = createNodesFromMarkup;
},{"./ExecutionEnvironment":186,"./createArrayFromMixed":190,"./getMarkupWrap":196,"./invariant":200}],192:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule emptyFunction
 */

"use strict";

function makeEmptyFunction(arg) {
  return function () {
    return arg;
  };
}

/**
 * This function accepts and discards inputs; it has no side effects. This is
 * primarily useful idiomatically for overridable function endpoints which
 * always need to be callable, since JS lacks a null-call idiom ala Cocoa.
 */
function emptyFunction() {}

emptyFunction.thatReturns = makeEmptyFunction;
emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
emptyFunction.thatReturnsNull = makeEmptyFunction(null);
emptyFunction.thatReturnsThis = function () {
  return this;
};
emptyFunction.thatReturnsArgument = function (arg) {
  return arg;
};

module.exports = emptyFunction;
},{}],193:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule emptyObject
 */

'use strict';

var emptyObject = {};

if ("production" !== 'production') {
  Object.freeze(emptyObject);
}

module.exports = emptyObject;
},{}],194:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule focusNode
 */

'use strict';

/**
 * @param {DOMElement} node input/textarea to focus
 */
function focusNode(node) {
  // IE8 can throw "Can't move focus to the control because it is invisible,
  // not enabled, or of a type that does not accept the focus." for all kinds of
  // reasons that are too expensive and fragile to test.
  try {
    node.focus();
  } catch (e) {}
}

module.exports = focusNode;
},{}],195:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getActiveElement
 * @typechecks
 */

/* eslint-disable fb-www/typeof-undefined */

/**
 * Same as document.activeElement but wraps in a try-catch block. In IE it is
 * not safe to call document.activeElement if there is nothing focused.
 *
 * The activeElement will be null only if the document or document body is not
 * yet defined.
 */
'use strict';

function getActiveElement() /*?DOMElement*/{
  if (typeof document === 'undefined') {
    return null;
  }
  try {
    return document.activeElement || document.body;
  } catch (e) {
    return document.body;
  }
}

module.exports = getActiveElement;
},{}],196:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getMarkupWrap
 */

/*eslint-disable fb-www/unsafe-html */

'use strict';

var ExecutionEnvironment = require('./ExecutionEnvironment');

var invariant = require('./invariant');

/**
 * Dummy container used to detect which wraps are necessary.
 */
var dummyNode = ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;

/**
 * Some browsers cannot use `innerHTML` to render certain elements standalone,
 * so we wrap them, render the wrapped nodes, then extract the desired node.
 *
 * In IE8, certain elements cannot render alone, so wrap all elements ('*').
 */

var shouldWrap = {};

var selectWrap = [1, '<select multiple="true">', '</select>'];
var tableWrap = [1, '<table>', '</table>'];
var trWrap = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

var svgWrap = [1, '<svg xmlns="http://www.w3.org/2000/svg">', '</svg>'];

var markupWrap = {
  '*': [1, '?<div>', '</div>'],

  'area': [1, '<map>', '</map>'],
  'col': [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  'legend': [1, '<fieldset>', '</fieldset>'],
  'param': [1, '<object>', '</object>'],
  'tr': [2, '<table><tbody>', '</tbody></table>'],

  'optgroup': selectWrap,
  'option': selectWrap,

  'caption': tableWrap,
  'colgroup': tableWrap,
  'tbody': tableWrap,
  'tfoot': tableWrap,
  'thead': tableWrap,

  'td': trWrap,
  'th': trWrap
};

// Initialize the SVG elements since we know they'll always need to be wrapped
// consistently. If they are created inside a <div> they will be initialized in
// the wrong namespace (and will not display).
var svgElements = ['circle', 'clipPath', 'defs', 'ellipse', 'g', 'image', 'line', 'linearGradient', 'mask', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect', 'stop', 'text', 'tspan'];
svgElements.forEach(function (nodeName) {
  markupWrap[nodeName] = svgWrap;
  shouldWrap[nodeName] = true;
});

/**
 * Gets the markup wrap configuration for the supplied `nodeName`.
 *
 * NOTE: This lazily detects which wraps are necessary for the current browser.
 *
 * @param {string} nodeName Lowercase `nodeName`.
 * @return {?array} Markup wrap configuration, if applicable.
 */
function getMarkupWrap(nodeName) {
  !!!dummyNode ? "production" !== 'production' ? invariant(false, 'Markup wrapping node not initialized') : invariant(false) : undefined;
  if (!markupWrap.hasOwnProperty(nodeName)) {
    nodeName = '*';
  }
  if (!shouldWrap.hasOwnProperty(nodeName)) {
    if (nodeName === '*') {
      dummyNode.innerHTML = '<link />';
    } else {
      dummyNode.innerHTML = '<' + nodeName + '></' + nodeName + '>';
    }
    shouldWrap[nodeName] = !dummyNode.firstChild;
  }
  return shouldWrap[nodeName] ? markupWrap[nodeName] : null;
}

module.exports = getMarkupWrap;
},{"./ExecutionEnvironment":186,"./invariant":200}],197:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getUnboundedScrollPosition
 * @typechecks
 */

'use strict';

/**
 * Gets the scroll position of the supplied element or window.
 *
 * The return values are unbounded, unlike `getScrollPosition`. This means they
 * may be negative or exceed the element boundaries (which is possible using
 * inertial scrolling).
 *
 * @param {DOMWindow|DOMElement} scrollable
 * @return {object} Map with `x` and `y` keys.
 */
function getUnboundedScrollPosition(scrollable) {
  if (scrollable === window) {
    return {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop
    };
  }
  return {
    x: scrollable.scrollLeft,
    y: scrollable.scrollTop
  };
}

module.exports = getUnboundedScrollPosition;
},{}],198:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule hyphenate
 * @typechecks
 */

'use strict';

var _uppercasePattern = /([A-Z])/g;

/**
 * Hyphenates a camelcased string, for example:
 *
 *   > hyphenate('backgroundColor')
 *   < "background-color"
 *
 * For CSS style names, use `hyphenateStyleName` instead which works properly
 * with all vendor prefixes, including `ms`.
 *
 * @param {string} string
 * @return {string}
 */
function hyphenate(string) {
  return string.replace(_uppercasePattern, '-$1').toLowerCase();
}

module.exports = hyphenate;
},{}],199:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule hyphenateStyleName
 * @typechecks
 */

'use strict';

var hyphenate = require('./hyphenate');

var msPattern = /^ms-/;

/**
 * Hyphenates a camelcased CSS property name, for example:
 *
 *   > hyphenateStyleName('backgroundColor')
 *   < "background-color"
 *   > hyphenateStyleName('MozTransition')
 *   < "-moz-transition"
 *   > hyphenateStyleName('msTransition')
 *   < "-ms-transition"
 *
 * As Modernizr suggests (http://modernizr.com/docs/#prefixed), an `ms` prefix
 * is converted to `-ms-`.
 *
 * @param {string} string
 * @return {string}
 */
function hyphenateStyleName(string) {
  return hyphenate(string).replace(msPattern, '-ms-');
}

module.exports = hyphenateStyleName;
},{"./hyphenate":198}],200:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule invariant
 */

'use strict';

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

function invariant(condition, format, a, b, c, d, e, f) {
  if ("production" !== 'production') {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  }

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(format.replace(/%s/g, function () {
        return args[argIndex++];
      }));
      error.name = 'Invariant Violation';
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
}

module.exports = invariant;
},{}],201:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isNode
 * @typechecks
 */

/**
 * @param {*} object The object to check.
 * @return {boolean} Whether or not the object is a DOM node.
 */
'use strict';

function isNode(object) {
  return !!(object && (typeof Node === 'function' ? object instanceof Node : typeof object === 'object' && typeof object.nodeType === 'number' && typeof object.nodeName === 'string'));
}

module.exports = isNode;
},{}],202:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isTextNode
 * @typechecks
 */

'use strict';

var isNode = require('./isNode');

/**
 * @param {*} object The object to check.
 * @return {boolean} Whether or not the object is a DOM text node.
 */
function isTextNode(object) {
  return isNode(object) && object.nodeType == 3;
}

module.exports = isTextNode;
},{"./isNode":201}],203:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule keyMirror
 * @typechecks static-only
 */

'use strict';

var invariant = require('./invariant');

/**
 * Constructs an enumeration with keys equal to their value.
 *
 * For example:
 *
 *   var COLORS = keyMirror({blue: null, red: null});
 *   var myColor = COLORS.blue;
 *   var isColorValid = !!COLORS[myColor];
 *
 * The last line could not be performed if the values of the generated enum were
 * not equal to their keys.
 *
 *   Input:  {key1: val1, key2: val2}
 *   Output: {key1: key1, key2: key2}
 *
 * @param {object} obj
 * @return {object}
 */
var keyMirror = function (obj) {
  var ret = {};
  var key;
  !(obj instanceof Object && !Array.isArray(obj)) ? "production" !== 'production' ? invariant(false, 'keyMirror(...): Argument must be an object.') : invariant(false) : undefined;
  for (key in obj) {
    if (!obj.hasOwnProperty(key)) {
      continue;
    }
    ret[key] = key;
  }
  return ret;
};

module.exports = keyMirror;
},{"./invariant":200}],204:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule keyOf
 */

/**
 * Allows extraction of a minified key. Let's the build system minify keys
 * without losing the ability to dynamically use key strings as values
 * themselves. Pass in an object with a single key/val pair and it will return
 * you the string key of that single record. Suppose you want to grab the
 * value for a key 'className' inside of an object. Key/val minification may
 * have aliased that key to be 'xa12'. keyOf({className: null}) will return
 * 'xa12' in that case. Resolve keys you want to use once at startup time, then
 * reuse those resolutions.
 */
"use strict";

var keyOf = function (oneKeyObj) {
  var key;
  for (key in oneKeyObj) {
    if (!oneKeyObj.hasOwnProperty(key)) {
      continue;
    }
    return key;
  }
  return null;
};

module.exports = keyOf;
},{}],205:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule mapObject
 */

'use strict';

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Executes the provided `callback` once for each enumerable own property in the
 * object and constructs a new object from the results. The `callback` is
 * invoked with three arguments:
 *
 *  - the property value
 *  - the property name
 *  - the object being traversed
 *
 * Properties that are added after the call to `mapObject` will not be visited
 * by `callback`. If the values of existing properties are changed, the value
 * passed to `callback` will be the value at the time `mapObject` visits them.
 * Properties that are deleted before being visited are not visited.
 *
 * @grep function objectMap()
 * @grep function objMap()
 *
 * @param {?object} object
 * @param {function} callback
 * @param {*} context
 * @return {?object}
 */
function mapObject(object, callback, context) {
  if (!object) {
    return null;
  }
  var result = {};
  for (var name in object) {
    if (hasOwnProperty.call(object, name)) {
      result[name] = callback.call(context, object[name], name, object);
    }
  }
  return result;
}

module.exports = mapObject;
},{}],206:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule memoizeStringOnly
 * @typechecks static-only
 */

'use strict';

/**
 * Memoizes the return value of a function that accepts one string argument.
 *
 * @param {function} callback
 * @return {function}
 */
function memoizeStringOnly(callback) {
  var cache = {};
  return function (string) {
    if (!cache.hasOwnProperty(string)) {
      cache[string] = callback.call(this, string);
    }
    return cache[string];
  };
}

module.exports = memoizeStringOnly;
},{}],207:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule performance
 * @typechecks
 */

'use strict';

var ExecutionEnvironment = require('./ExecutionEnvironment');

var performance;

if (ExecutionEnvironment.canUseDOM) {
  performance = window.performance || window.msPerformance || window.webkitPerformance;
}

module.exports = performance || {};
},{"./ExecutionEnvironment":186}],208:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule performanceNow
 * @typechecks
 */

'use strict';

var performance = require('./performance');

var performanceNow;

/**
 * Detect if we can use `window.performance.now()` and gracefully fallback to
 * `Date.now()` if it doesn't exist. We need to support Firefox < 15 for now
 * because of Facebook's testing infrastructure.
 */
if (performance.now) {
  performanceNow = function () {
    return performance.now();
  };
} else {
  performanceNow = function () {
    return Date.now();
  };
}

module.exports = performanceNow;
},{"./performance":207}],209:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule shallowEqual
 * @typechecks
 * 
 */

'use strict';

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Performs equality by iterating through keys on an object and returning false
 * when any key has values which are not strictly equal between the arguments.
 * Returns true when the values of all keys are strictly equal.
 */
function shallowEqual(objA, objB) {
  if (objA === objB) {
    return true;
  }

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false;
  }

  var keysA = Object.keys(objA);
  var keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  var bHasOwnProperty = hasOwnProperty.bind(objB);
  for (var i = 0; i < keysA.length; i++) {
    if (!bHasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
      return false;
    }
  }

  return true;
}

module.exports = shallowEqual;
},{}],210:[function(require,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule toArray
 * @typechecks
 */

'use strict';

var invariant = require('./invariant');

/**
 * Convert array-like objects to arrays.
 *
 * This API assumes the caller knows the contents of the data type. For less
 * well defined inputs use createArrayFromMixed.
 *
 * @param {object|function|filelist} obj
 * @return {array}
 */
function toArray(obj) {
  var length = obj.length;

  // Some browse builtin objects can report typeof 'function' (e.g. NodeList in
  // old versions of Safari).
  !(!Array.isArray(obj) && (typeof obj === 'object' || typeof obj === 'function')) ? "production" !== 'production' ? invariant(false, 'toArray: Array-like object expected') : invariant(false) : undefined;

  !(typeof length === 'number') ? "production" !== 'production' ? invariant(false, 'toArray: Object needs a length property') : invariant(false) : undefined;

  !(length === 0 || length - 1 in obj) ? "production" !== 'production' ? invariant(false, 'toArray: Object should have keys for indices') : invariant(false) : undefined;

  // Old IE doesn't give collections access to hasOwnProperty. Assume inputs
  // without method will throw during the slice call and skip straight to the
  // fallback.
  if (obj.hasOwnProperty) {
    try {
      return Array.prototype.slice.call(obj);
    } catch (e) {
      // IE < 9 does not support Array#slice on collections objects
    }
  }

  // Fall back to copying key by key. This assumes all keys have a value,
  // so will not preserve sparsely populated inputs.
  var ret = Array(length);
  for (var ii = 0; ii < length; ii++) {
    ret[ii] = obj[ii];
  }
  return ret;
}

module.exports = toArray;
},{"./invariant":200}],211:[function(require,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule warning
 */

'use strict';

var emptyFunction = require('./emptyFunction');

/**
 * Similar to invariant but only logs a warning if the condition is not met.
 * This can be used to log issues in development environments in critical
 * paths. Removing the logging code for production environments will keep the
 * same logic and follow the same code paths.
 */

var warning = emptyFunction;

if ("production" !== 'production') {
  warning = function (condition, format) {
    for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }

    if (format === undefined) {
      throw new Error('`warning(condition, format, ...args)` requires a warning ' + 'message argument');
    }

    if (format.indexOf('Failed Composite propType: ') === 0) {
      return; // Ignore CompositeComponent proptype check.
    }

    if (!condition) {
      var argIndex = 0;
      var message = 'Warning: ' + format.replace(/%s/g, function () {
        return args[argIndex++];
      });
      if (typeof console !== 'undefined') {
        console.error(message);
      }
      try {
        // --- Welcome to debugging React ---
        // This error was thrown as a convenience so that you can use this stack
        // to find the callsite that caused this warning to fire.
        throw new Error(message);
      } catch (x) {}
    }
  };
}

module.exports = warning;
},{"./emptyFunction":192}],212:[function(require,module,exports){
'use strict';

module.exports = require('./lib/React');

},{"./lib/React":80}],213:[function(require,module,exports){
/*!
* screenfull
* v3.0.0 - 2015-11-24
* (c) Sindre Sorhus; MIT License
*/
(function () {
	'use strict';

	var isCommonjs = typeof module !== 'undefined' && module.exports;
	var keyboardAllowed = typeof Element !== 'undefined' && 'ALLOW_KEYBOARD_INPUT' in Element;

	var fn = (function () {
		var val;
		var valLength;

		var fnMap = [
			[
				'requestFullscreen',
				'exitFullscreen',
				'fullscreenElement',
				'fullscreenEnabled',
				'fullscreenchange',
				'fullscreenerror'
			],
			// new WebKit
			[
				'webkitRequestFullscreen',
				'webkitExitFullscreen',
				'webkitFullscreenElement',
				'webkitFullscreenEnabled',
				'webkitfullscreenchange',
				'webkitfullscreenerror'

			],
			// old WebKit (Safari 5.1)
			[
				'webkitRequestFullScreen',
				'webkitCancelFullScreen',
				'webkitCurrentFullScreenElement',
				'webkitCancelFullScreen',
				'webkitfullscreenchange',
				'webkitfullscreenerror'

			],
			[
				'mozRequestFullScreen',
				'mozCancelFullScreen',
				'mozFullScreenElement',
				'mozFullScreenEnabled',
				'mozfullscreenchange',
				'mozfullscreenerror'
			],
			[
				'msRequestFullscreen',
				'msExitFullscreen',
				'msFullscreenElement',
				'msFullscreenEnabled',
				'MSFullscreenChange',
				'MSFullscreenError'
			]
		];

		var i = 0;
		var l = fnMap.length;
		var ret = {};

		for (; i < l; i++) {
			val = fnMap[i];
			if (val && val[1] in document) {
				for (i = 0, valLength = val.length; i < valLength; i++) {
					ret[fnMap[0][i]] = val[i];
				}
				return ret;
			}
		}

		return false;
	})();

	var screenfull = {
		request: function (elem) {
			var request = fn.requestFullscreen;

			elem = elem || document.documentElement;

			// Work around Safari 5.1 bug: reports support for
			// keyboard in fullscreen even though it doesn't.
			// Browser sniffing, since the alternative with
			// setTimeout is even worse.
			if (/5\.1[\.\d]* Safari/.test(navigator.userAgent)) {
				elem[request]();
			} else {
				elem[request](keyboardAllowed && Element.ALLOW_KEYBOARD_INPUT);
			}
		},
		exit: function () {
			document[fn.exitFullscreen]();
		},
		toggle: function (elem) {
			if (this.isFullscreen) {
				this.exit();
			} else {
				this.request(elem);
			}
		},
		raw: fn
	};

	if (!fn) {
		if (isCommonjs) {
			module.exports = false;
		} else {
			window.screenfull = false;
		}

		return;
	}

	Object.defineProperties(screenfull, {
		isFullscreen: {
			get: function () {
				return Boolean(document[fn.fullscreenElement]);
			}
		},
		element: {
			enumerable: true,
			get: function () {
				return document[fn.fullscreenElement];
			}
		},
		enabled: {
			enumerable: true,
			get: function () {
				// Coerce to boolean in case of old WebKit
				return Boolean(document[fn.fullscreenEnabled]);
			}
		}
	});

	if (isCommonjs) {
		module.exports = screenfull;
	} else {
		window.screenfull = screenfull;
	}
})();

},{}]},{},[37]);