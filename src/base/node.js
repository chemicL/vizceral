/**
 *
 *  Copyright 2016 Netflix, Inc.
 *
 *     Licensed under the Apache License, Version 2.0 (the "License");
 *     you may not use this file except in compliance with the License.
 *     You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *     Unless required by applicable law or agreed to in writing, software
 *     distributed under the License is distributed on an "AS IS" BASIS,
 *     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *     See the License for the specific language governing permissions and
 *     limitations under the License.
 *
 */
import _ from 'lodash';

import GraphObject from './graphObject';
import NodeViewStandard from './nodeViewStandard';
import NodeViewDetailed from './nodeViewDetailed';
import Notices from '../notices';

const Console = console;

class Node extends GraphObject {
  constructor (node, type) {
    super();
    this.update(node);
    this.minimumNoticeLevel = 0;

    this.type = type;
    this.position = this.position || {};
    this.position.x = this.position.x || 0;
    this.position.y = this.position.y || 0;

    this.updateBoundingBox();

    this.incomingConnections = [];
    this.outgoingConnections = [];

    this.connected = false;

    this.invalidatedSinceLastViewUpdate = true;

    this.options = {
      showLabel: true
    };

    this.data = {
      volume: { type: 'number', value: NaN },
      volumePercent: { type: 'percent', value: 0 },
      classPercents: {}
    };
  }

  addIncomingConnection (connection) {
    this.incomingConnections.push(connection);
    this.invalidateIncomingVolume();
    this.connected = true;
  }

  addOutgoingConnection (connection) {
    this.outgoingConnections.push(connection);
    this.invalidateOutgoingVolume();
    this.connected = true;
  }

  removeIncomingConnection (connection) {
    this.incomingConnections = _.remove(this.incomingConnections, incomingConnection => incomingConnection.name === connection.name);
    if (this.incomingConnections.length === 0 && this.outgoingConnections.length === 0) {
      this.connected = false;
    }
  }

  removeOutgoingConnection (connection) {
    this.outgoingConnections = _.remove(this.outgoingConnections, outgoingConnection => outgoingConnection.name === connection.name);
    if (this.incomingConnections.length === 0 && this.outgoingConnections.length === 0) {
      this.connected = false;
    }
  }

  invalidateIncomingVolume () {
    this.invalidatedSinceLastViewUpdate = true;
    this.incomingVolumeTotal = undefined;
    this.incomingVolume = {};
  }

  validateIncomingVolume () {
    this.incomingVolumeTotal = _.reduce(this.incomingConnections, (total, connection) => total + connection.getVolumeTotal(), 0);
    _.each(this.incomingConnections, c => {
      _.each(c.volume, (value, key) => {
        this.incomingVolume[key] = this.incomingVolume[key] || 0;
        this.incomingVolume[key] += value;
      });
    });
  }

  getIncomingVolume (key) {
    if (!key) {
      if (!this.incomingVolumeTotal) { this.validateIncomingVolume(); }
      return this.incomingVolumeTotal;
    }

    if (!this.incomingVolume[key]) { this.validateIncomingVolume(); }
    return this.incomingVolume[key];
  }

  invalidateOutgoingVolume () {
    this.invalidatedSinceLastViewUpdate = true;
    this.outgoingVolumeTotal = undefined;
    this.outgoingVolume = {};
  }

  validateOutgoingVolume () {
    this.outgoingVolumeTotal = _.reduce(this.outgoingConnections, (total, connection) => total + connection.getVolumeTotal(), 0);
    _.each(this.outgoingConnections, c => {
      _.each(c.volume, (value, key) => {
        this.outgoingVolume[key] = this.outgoingVolume[key] || 0;
        this.outgoingVolume[key] += value;
      });
    });
  }

  getOutgoingVolume (key) {
    if (!key) {
      if (!this.outgoingVolumeTotal) { this.validateOutgoingVolume(); }
      return this.outgoingVolumeTotal;
    }

    if (!this.outgoingVolume[key]) { this.validateOutgoingVolume(); }
    return this.outgoingVolume[key];
  }

  updatePosition (position, depth) {
    if (position !== undefined) {
      if ((position.x !== undefined && position.x !== this.position.x)
        || (position.y !== undefined && position.y !== this.position.y)) {
        this.position.x = position.x;
        this.position.y = position.y;
      }
    }
    if (depth !== undefined) {
      this.depth = depth;
    }
    this.updateBoundingBox();
  }

  updateBoundingBox () {
    if (this.view) {
      this.boundingBox = {
        top: this.position.y - this.view.radius,
        right: this.position.x + this.view.radius,
        bottom: this.position.y + this.view.radius,
        left: this.position.x - this.view.radius
      };
    } else {
      this.boundingBox = {
        top: this.position.y - 16,
        right: this.position.x + 16,
        bottom: this.position.y + 16,
        left: this.position.x - 16
      };
    }
  }

  getClass () {
    if (this.class === undefined) {
      Console.warn(`Node ${this.name} does not have a class, returning 'normal'.`);
    }
    return this.class || 'normal';
  }

  hasVisibleConnections () {
    return !(_.every(this.incomingConnections, connection => !connection.isVisible())
      && _.every(this.outgoingConnections, connection => !connection.isVisible()));
  }

  hasDefaultVisibleConnections () {
    return !(_.every(this.incomingConnections, connection => connection.defaultFiltered)
      && _.every(this.outgoingConnections, connection => connection.defaultFiltered));
  }

  render () {
    this.views = {
      standard: new NodeViewStandard(this),
      detailed: new NodeViewDetailed(this)
    };
    // Set the default view type
    this.view = this.type === 'region' ? this.views.detailed : this.views.standard;
  }

  showNotices () {
    if (this.view) { Notices.showNotices(this.view.container, this.notices); }
  }


  showDetailedView (showDetailed) {
    if (!this.views) { this.render(); }
    const detailedViewShown = this.view === this.views.detailed;
    if (detailedViewShown !== showDetailed) {
      if (showDetailed) {
        this.view = this.views.detailed;
        this.focused = true;
        this.view.refresh();
      } else {
        this.view = this.views.standard;
        this.focused = false;
      }
    }
  }

  updateData (totalVolume) {
    let updated = false;

    if (this.invalidatedSinceLastViewUpdate) {
      this.invalidatedSinceLastViewUpdate = false;
      const serviceVolume = this.isEntryNode() ? totalVolume : this.getIncomingVolume();
      if (this.data.volume.value !== serviceVolume) {
        this.data.volume.value = serviceVolume;
        updated = true;
      }
      if (!serviceVolume) {
        this.data.volumePercent.value = 0;
        _.each(this.data.classPercents, (v, k) => { this.data.classPercents[k] = 0; });
      } else {
        const serviceVolumePercent = serviceVolume / totalVolume;
        if (this.data.volumePercent.value !== serviceVolumePercent) {
          this.data.volumePercent.value = serviceVolumePercent;
          updated = true;
        }
        _.each(this.isEntryNode() ? this.outgoingVolume : this.incomingVolume, (volume, key) => {
          const classVolumePercent = volume / serviceVolume;
          this.data.classPercents[key] = this.data.classPercents[key] || { type: 'percent', value: 0 };
          if (this.data.classPercents[key].value !== classVolumePercent) {
            this.data.classPercents[key].value = classVolumePercent;
            updated = true;
          }
        });
      }
    }
    return updated;
  }

  update (stateNode) {
    const needsRefresh = this.class !== stateNode.class;
    _.assign(this, stateNode);
    if (needsRefresh && this.view) { this.view.refresh(); }
  }

  updateRPS (rps) {
    this.updated = this.updateData(rps);
  }

  showLabel (showLabel) {
    if (this.options.showLabel !== showLabel) {
      this.options.showLabel = showLabel;
      if (this.view !== undefined) {
        _.each(this.views, view => {
          view.showLabel(showLabel);
        });
      }
    }
  }

  connectedTo (nodeName) {
    if (super.connectionTo(nodeName)) { return true; }

    return !(_.every(this.incomingConnections, connection => connection.source.getName() !== nodeName)
      && _.every(this.outgoingConnections, connection => connection.source.getName() !== nodeName));
  }

  isEntryNode () {
    return this.getName() === 'INTERNET';
  }

  isClickable () {
    return this.isInteractive();
  }

  isInteractive () {
    return (this.type === 'region' && !this.isEntryNode())
      || (this.type === 'service' && this.view !== this.views.detailed);
  }

  cleanup () {
    if (this.views) {
      _.each(this.views, view => view.cleanup());
    }
  }
}

export default Node;
