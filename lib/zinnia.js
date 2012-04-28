(function (factory) {
    if (typeof exports === 'object') {
        factory(exports);
    }

    if (typeof define === 'function') {
        define(function () {
            var z = { };
            factory(z);
            return z;
        });
    } else if (typeof window === 'object') {
        var z = { };
        factory(z);
        ZINNIA = z; // global
    }
})(function (exports) {

var IS_NODE = typeof module === 'object';
var IS_BROWSER = typeof window === 'object';

// Are typed arrays available and working?
var HAS_TYPED_ARRAYS = typeof Uint8Array === 'function';

// Should the model be parsed using the buffer interface?
var USE_MODEL_BUFFER = IS_NODE;

var DIC_VERSION = 1;
var DIC_MAGIC_ID = 0xEF71821;
var MAX_CHARACTER_SIZE = 50;

// inline double dot(const FeatureNode *x1,
//                   const FeatureNode *x2)
function featureDot(as, bs) {
    var ia = 0, ib = 0;
    var sum = 0;

    while (ia < as.length && ib < bs.length) {
        var a = as[ia];
        var b = bs[ib];

        if (a.index === b.index) {
            sum += a.value * b.value;
            ++ia;
            ++ib;
        } else if (a.index < b.index) {
            ++ia;
        } else {
            ++ib;
        }
    }

    return sum;
}

function validateCharacter(c) {
    // TODO
}

// float minimum_distance(const Node *first, const Node *last,
//                        Node **best)
function minimumDistance(nodes, firstI, lastI) {
    if (firstI === lastI) {
        // FIXME?
        return [ null, 0 ];
    }

    var a = nodes[lastI + 0] - nodes[firstI + 0];
    var b = nodes[lastI + 1] - nodes[firstI + 1];
    var c = nodes[lastI + 1] * nodes[firstI + 0]
          - nodes[lastI + 0] * nodes[firstI + 1];

    var max = -1;
    var bestI = null; // ?

    for (var curI = firstI; curI !== lastI; curI += 2) {
        var dist = Math.abs(
            a * nodes[curI + 1]
          - b * nodes[curI + 0]
          + c
        );

        if (dist > max) {
            max = dist;
            bestI = curI;
        }
    }

    return [ bestI, max * max / (a * a + b * b) ];
}

// void Features::getVertex(const Node *first, const Node *last,
//                         int id,
//                         std::vector<NodePair> *node_pairs) const
function getVertex(nodes, firstI, lastI, id, pairs) {
    // TODO Optimize pairs data structure
    pairs[id] = {
        firstI: firstI,
        lastI: lastI
    };

    var result = minimumDistance(nodes, firstI, lastI);
    var bestI = result[0];
    var distance = result[1];

    var ERROR = 0.001;
    if (distance > ERROR) {
        getVertex(nodes, firstI, bestI, id * 2 + 1, pairs);
        getVertex(nodes, bestI, lastI, id * 2 + 2, pairs);
    }
}

// float distance(const Node *n1, const Node *n2)
function distance(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}

// float distance2(const Node *n1)
function distance2(x, y) {
    return distance(x, y, 0.5, 0.5);
}

// bool Features::read(const Character &character)
function characterToFeatures(character) {
    validateCharacter(character);

    var features = [ ];

    function addFeature(index, value) {
        features.push({
            index: index,
            value: value
        });
    }

    // Bias term
    addFeature(0, 1);

    var width = character.width;
    if (width <= 0) {
        throw new Error("Invalid character width: " + width);
    }

    var height = character.height;
    if (height <= 0) {
        throw new Error("Invalid character height: " + height);
    }

    var strokes = character.strokes;
    if (strokes.length === 0) {
        throw new Error("Character must have at least one stroke");
    }

    // Large flattened array with stroke coordinates inside.
    //
    // Structure is:
    //
    //   struct {
    //     struct {
    //       struct {
    //         float x, y;
    //       } points[i];
    //     } strokes[j];
    //   } nodes;
    //
    // You can thus access the "y" coordinate of point 3 of
    // stroke 2 using:
    //
    //   nodes[strokeOffsets[2] + 2*3 + 1]
    //
    // Variables suffixed with "I" indicate indices into this
    // array.
    //
    // TODO Typed array
    var nodes = [ ];
    var strokeOffsets = [ ];
    var curStrokeOffset = 0;
    strokes.forEach(function (stroke, strokeIndex) {
        // TODO Move this into validateCharacter
        if (stroke.length < 2) {
            throw new Error("Stroke " + strokeIndex + " must have at least one point");
        }

        if (stroke.length % 2 !== 0) {
            throw new Error("Stroke " + strokeIndex + " must have an even number of coordinates");
        }

        for (var i = 0; i < stroke.length; i += 2) {
            nodes.push(
                stroke[i + 0] / width,
                stroke[i + 1] / height
            );
        }

        strokeOffsets.push(curStrokeOffset);
        curStrokeOffset += stroke.length;
    });
    strokeOffsets.push(curStrokeOffset);

    // void Features::makeBasicFeature(int offset,
    //                                 const Node *first,
    //                                 const Node *last)
    function makeBasicFeature(offset, firstX, firstY, lastX, lastY) {
        // distance
        addFeature(offset + 1 , 10 * distance(firstX, firstY, lastX, lastY));

        // degree
        addFeature(offset + 2, Math.atan2(lastY - firstY, lastX - firstX));

        // absolute position
        addFeature(offset + 3, 10 * (firstX - 0.5));
        addFeature(offset + 4, 10 * (firstY - 0.5));
        addFeature(offset + 5, 10 * (lastX - 0.5));
        addFeature(offset + 6, 10 * (lastY - 0.5));

        // absolute degree
        addFeature(offset + 7, Math.atan2(firstY - 0.5, firstX - 0.5));
        addFeature(offset + 8, Math.atan2(lastY - 0.5,  lastX - 0.5));

        // absolute distance
        addFeature(offset + 9,  10 * distance2(firstX, firstY));
        addFeature(offset + 10, 10 * distance2(lastX, lastY));

        // diff
        addFeature(offset + 11, 5 * (lastX - firstX));
        addFeature(offset + 12, 5 * (lastY - firstY));
    }

    // void Features::makeVertexFeature(int sid,
    //                                  std::vector<NodePair> *node_pairs)
    function makeVertexFeature(nodes, sid, nodePairs) {
        for (var i = 0; i < nodePairs.length; ++i) {
            if (i > MAX_CHARACTER_SIZE) {
                break;
            }

            var n = nodePairs[i];
            if (!n) {
                continue;
            }

            var offset = sid * 1000 + 20 * i;
            makeBasicFeature(
                offset,
                nodes[n.firstI + 0],
                nodes[n.firstI + 1],
                nodes[n.lastI + 0],
                nodes[n.lastI + 1]
            );
        }
    }

    // void Features::makeMoveFeature(int sid,
    //                                const Node *first,
    //                                const Node *last)
    function makeMoveFeature(id, firstX, firstY, lastX, lastY) {
      var offset = 100000 + id * 1000;
      makeBasicFeature(offset, firstX, firstY, lastX, lastY);
    }

    var prevI;
    for (var i = 0; i < strokes.length; ++i) {
        var firstI = strokeOffsets[i];
        var lastI = strokeOffsets[i + 1] - 2;

        // TODO Typed array?
        var nodePairs = [ ];
        getVertex(nodes, firstI, lastI, 0, nodePairs);

        makeVertexFeature(nodes, i, nodePairs);
        if (i > 0) {
            makeMoveFeature(
                i,
                nodes[prevI + 0],
                nodes[prevI + 1],
                nodes[firstI + 0],
                nodes[firstI + 1]
            );
        }

        prevI = lastI;
    }

    addFeature(2000000, strokes.length);
    addFeature(2000000 + strokes.length, 10);

    features.sort(function (a, b) {
        if (a.index < b.index) return -1;
        if (a.index > b.index) return +1;
        return 0;
    });

    return features;
}

function Recognizer(models) {
    this.models = models;
}

Recognizer.prototype.classify = function classify(character, nbest) {
    validateCharacter(character);

    if (typeof nbest === 'undefined') {
        nbest = Infinity;
    }

    if (!this.models.length || nbest <= 0) {
        return [ ];
    }

    var features = characterToFeatures(character);

    // TODO Easily parallelizable!
    var results = [ ];
    for (var i = 0; i < this.models.length; ++i) {
        var model = this.models[i];
        results.push({
            bias: model.bias + featureDot(model.features, features),
            code: model.code
        });
    }

    // TODO Partial sort
    results.sort(function (a, b) {
        if (a.bias < b.bias) return -1;
        if (a.bias > b.bias) return +1;
        return 0;
    });
    results.reverse();

    return results.slice(0, nbest);
};

function modelToJSON() {
    return this;
}

function modelFromJSON(obj) {
    if (typeof obj === 'string') {
        obj = JSON.parse(obj);
    }

    if (!Array.isArray(obj)) {
        throw new Error("Invalid model JSON");
    }

    obj.toJSON = modelToJSON;
    return obj;
}

function parseModelFileBuffer(buffer) {
    var offset = 0;
    var byteLength = USE_MODEL_BUFFER
        ? buffer.length
        : buffer.byteLength;

    var u32, float32, bytes;

    if (USE_MODEL_BUFFER) {
        var u32 = function () {
            var ret = buffer.readUInt32LE(offset);
            offset += 4;
            return ret;
        };

        var float32 = function () {
            var ret = buffer.readFloatLE(offset);
            offset += 4;
            return ret;
        };

        var bytes = function (count) {
            var ret = buffer.slice(offset, offset + count);
            offset += count;
            return ret;
        };
    } else {
        // This implementation assumes all words are aligned.
        var u32Array = new Uint32Array(buffer);
        var float32Array = new Float32Array(buffer);
        var byteArray = new Uint8Array(buffer);

        var u32 = function () {
            var ret = u32Array[offset / 4];
            offset += 4;
            return ret;
        };

        var float32 = function () {
            var ret = float32Array[offset / 4];
            offset += 4;
            return ret;
        };

        var bytes = function (count) {
            if (count % 4 !== 0) {
                throw new Error("Zinnia.js internal error: Bad byte count: " + count);
            }

            var ret = byteArray.subarray(offset, offset + count);
            offset += count;
            return ret;
        };
    }

    function utf8FixedString(count) {
        var raw = bytes(count);

        var offset = 0;
        function read() {
            if (offset >= count) {
                return 0;
            }

            var ret = raw[offset];
            offset += 1;
            return ret;
        }

        // Adopted from code by
        // http://www.webtoolkit.info/javascript-utf8.html
        var fcc = String.fromCharCode;

        var string = '';
        var b;
        while ((b = read()) !== 0) {
            if (b < 128) {
                string += fcc(b);
            } else if (b > 191 && b < 224) {
                var b2 = read();
                string += fcc(((b & 31) << 6) | (b2 & 63));
            } else {
                var b2 = read();
                var b3 = read();
                string += fcc(((b & 15) << 12) | ((b2 & 63) << 6) | (b3 & 63));
            }
        }

        return string;
    }

    function parseModel() {
        var code = utf8FixedString(16);
        var bias = float32();

        // TODO Typed array
        var features = [ ];
        while (true) {
            var index = u32();
            var value = float32();

            if (index === 0xFFFFFFFF) {
                break;
            }

            features.push({
                index: index,
                value: value
            });
        }

        return {
            code: code,
            bias: bias,
            features: features
        };
    }

    var magic = u32();
    if ((magic ^ DIC_MAGIC_ID) !== buffer.length) {
        throw new Error("Magic did not match");
    }

    var version = u32();
    if (version !== DIC_VERSION) {
        throw new Error("Incompatible version: " + version);
    }

    var models = [ ];
    var modelCount = u32();
    for (var modelIndex = 0; modelIndex < modelCount; ++modelIndex) {
        models.push(parseModel());
    }

    if (offset !== buffer.length) {
        throw new Error("Expected EOF, but " + (offset - buffer.length) + " more bytes found");
    }

    models.toJSON = modelToJSON;
    return models;
}

function modelLoadFromFile(filename, callback) {
    if (IS_NODE) {
        require('fs').readFile(filename, function on_readFile(err, data) {
            if (err) return callback(err);

            var models;
            try {
                models = parseModelFileBuffer(data);
            } catch (e) {
                return callback(e);
            }
            callback(null, models);
        });
    } else if (IS_BROWSER) {
        if (!HAS_TYPED_ARRAYS) {
            throw new Error("Can only load a model from a file in typed arrays are available");
        }

        // TODO
        throw new Error("model.loadFromFile not implemented for browsers");
    } else {
        throw new Error("Environment not supported in model.loadFromFile");
    }
}

function modelLoadFromJSONFile(filename, callback) {
    if (IS_BROWSER) {
        // TODO Better error handling
        var xhr = new XMLHttpRequest();
        xhr.open('GET', filename, true);
        try {
            xhr.responseType = 'json';
        } catch (e) {
            // Ignore; do nothing
        }
        xhr.onload = function () {
            var model;
            try {
                model = modelFromJSON(
                    xhr.response || JSON.parse(xhr.responseText)
                );
            } catch (e) {
                return callback(e);
            }
            callback(null, model);
        };
        xhr.send();
    } else {
        throw new Error("Environment not supported in model.loadFromJSONFile");
    }
}

function recognizerFromModel(model) {
    return new Recognizer(model);
}

exports.model = {
    loadFromFile: modelLoadFromFile,
    loadFromJSONFile: modelLoadFromJSONFile,
    fromJSON: modelFromJSON
};

exports.recognizer = {
    fromModel: recognizerFromModel
};

});
