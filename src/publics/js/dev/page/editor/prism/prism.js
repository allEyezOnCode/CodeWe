/**
 * Substring replace call to replace part of a string at a certain position
 *
 * @param {number} position         the position where the replacement
 *                                  should happen
 * @param {string} replace          the text we want to replace
 * @param {string} replaceWith      the text we want to replace it with
 * @param {string} code             the code we are doing the replacing in
 * @return {string}
 */
function replaceAtPosition(position, replace, replaceWith, code) {
    const subString = code.substr(position);

    // This is needed to fix an issue where $ signs do not render in the
    // highlighted code
    //
    // @see https://github.com/ccampbell/rainbow/issues/208
    replaceWith = replaceWith.replace(/\$/g, '$$$$');

    return code.substr(0, position) + subString.replace(replace, replaceWith);
}

/**
 * Finds out the position of group match for a regular expression
 *
 * @see http://stackoverflow.com/questions/1985594/how-to-find-index-of-groups-in-match
 * @param {Object} match
 * @param {number} groupNumber
 * @return {number}
 */
function indexOfGroup(match, groupNumber) {
    let index = 0;

    for (let i = 1; i < groupNumber; ++i) {
        if (match[i]) {
            index += match[i].length;
        }
    }

    return index;
}

/**
 * Sorts an objects keys by index descending
 *
 * @param {Object} object
 * @return {Array}
 */
function keys(object) {
    const locations = [];

    for (const location in object) {
        if (object.hasOwnProperty(location)) {
            locations.push(location);
        }
    }

    // numeric descending
    return locations.sort((a, b) => b - a);
}

/**
 * Determines if two different matches have complete overlap with each other
 *
 * @param {number} start1   start position of existing match
 * @param {number} end1     end position of existing match
 * @param {number} start2   start position of new match
 * @param {number} end2     end position of new match
 * @return {boolean}
 */
function hasCompleteOverlap(start1, end1, start2, end2) {

    // If the starting and end positions are exactly the same
    // then the first one should stay and this one should be ignored.
    if (start2 === start1 && end2 === end1) {
        return false;
    }

    return start2 <= start1 && end2 >= end1;
}

/**
 * Determines if a new match intersects with an existing one
 *
 * @param {number} start1    start position of existing match
 * @param {number} end1      end position of existing match
 * @param {number} start2    start position of new match
 * @param {number} end2      end position of new match
 * @return {boolean}
 */
function intersects(start1, end1, start2, end2) {
    if (start2 >= start1 && start2 < end1) {
        return true;
    }

    return end2 > start1 && end2 < end1;
}

/**
 * Prism is a class used to highlight individual blocks of code
 *
 * @class
 */
export class Prism {
    constructor(patterns) {

        this.patterns = patterns;

        /**
         * Object of replacements to process at the end of the processing
         *
         * @type {Object}
         */
        const replacements = {};

        /**
         * Language associated with this Prism object
         *
         * @type {string}
         */
        let currentLanguage;

        /**
         * Object of start and end positions of blocks to be replaced
         *
         * @type {Object}
         */
        const replacementPositions = {};

        /**
         * Determines if the match passed in falls inside of an existing match.
         * This prevents a regex pattern from matching inside of another pattern
         * that matches a larger amount of code.
         *
         * For example this prevents a keyword from matching `function` if there
         * is already a match for `function (.*)`.
         *
         * @param {number} start    start position of new match
         * @param {number} end      end position of new match
         * @return {boolean}
         */
        function _matchIsInsideOtherMatch(start, end) {
            for (let key in replacementPositions) {
                key = parseInt(key, 10);

                // If this block completely overlaps with another block
                // then we should remove the other block and return `false`.
                if (hasCompleteOverlap(key, replacementPositions[key], start, end)) {
                    delete replacementPositions[key];
                    delete replacements[key];
                }

                if (intersects(key, replacementPositions[key], start, end)) {
                    return true;
                }
            }

            return false;
        }

        /**
         * Takes a string of code and wraps it in a span tag based on the name
         *
         * @param {string} name        name of the pattern (ie keyword.regex)
         * @param {string} code        block of code to wrap
         * @param {string} globalClass class to apply to every span
         * @return {string}
         */
        function _wrapCodeInSpan(name, code) {
            let className = name.replace(/\./g, ' ');
            return `<span class="${className}">${code}</span>`;
        }

        /**
         * Process replacements in the string of code to actually update
         * the markup
         *
         * @param {string} code         the code to process replacements in
         * @return {string}
         */
        function _processReplacements(code) {
            const positions = keys(replacements);
            for (const position of positions) {
                const replacement = replacements[position];
                code = replaceAtPosition(position, replacement.replace, replacement.with, code);
            }
            return code;
        }

        /**
         * It is so we can create a new regex object for each call to
         * _processPattern to avoid state carrying over when running exec
         * multiple times.
         *
         * The global flag should not be carried over because we are simulating
         * it by processing the regex in a loop so we only care about the first
         * match in each string. This also seems to improve performance quite a
         * bit.
         *
         * @param {RegExp} regex
         * @return {string}
         */
        function _cloneRegex(regex) {
            let flags = '';

            if (regex.ignoreCase) {
                flags += 'i';
            }

            if (regex.multiline) {
                flags += 'm';
            }

            return new RegExp(regex.source, flags);
        }

        /**
         * Matches a regex pattern against a block of code, finds all matches
         * that should be processed, and stores the positions of where they
         * should be replaced within the string.
         *
         * This is where pretty much all the work is done but it should not
         * be called directly.
         *
         * @param {Prism} instance
         * @param {Object} pattern
         * @param {string} code
         * @param {number} offset
         * @return {mixed}
         */
        function _processPattern(instance, pattern, code, offset = 0) {
            let regex = pattern.pattern;
            if (!regex) {
                return false;
            }

            // Since we are simulating global regex matching we need to also
            // make sure to stop after one match if the pattern is not global
            const shouldStop = !regex.global;

            regex = _cloneRegex(regex);
            const match = regex.exec(code);

            if (!match) {
                return false;
            }

            // Treat match 0 the same way as name
            if (!pattern.name && pattern.matches && typeof pattern.matches[0] === 'string') {
                pattern.name = pattern.matches[0];
                delete pattern.matches[0];
            }

            let replacement = match[0];
            const startPos = match.index + offset;
            const endPos = match[0].length + startPos;

            // In some cases when the regex matches a group such as \s* it is
            // possible for there to be a match, but have the start position
            // equal the end position. In those cases we should be able to stop
            // matching. Otherwise this can lead to an infinite loop.
            if (startPos === endPos) {
                return false;
            }

            // If this is not a child match and it falls inside of another
            // match that already happened we should skip it and continue
            // processing.
            if (_matchIsInsideOtherMatch(startPos, endPos)) {
                return {
                    remaining: code.substr(endPos - offset),
                    offset: endPos
                };
            }

            /**
             * Callback for when a match was successfully processed
             *
             * @param {string} repl
             * @return {void}
             */
            function onMatchSuccess(repl) {

                // If this match has a name then wrap it in a span tag
                if (pattern.name) {
                    repl = _wrapCodeInSpan(pattern.name, repl);
                }

                // For debugging
                // console.log('Replace ' + match[0] + ' with ' + replacement + ' at position ' + startPos + ' to ' + endPos);

                // Store what needs to be replaced with what at this position
                replacements[startPos] = {
                    'replace': match[0],
                    'with': repl
                };

                // Store the range of this match so we can use it for
                // comparisons with other matches later.
                replacementPositions[startPos] = endPos;

                if (shouldStop) {
                    return false;
                }

                return {
                    remaining: code.substr(endPos - offset),
                    offset: endPos
                };
            }

            /**
             * Helper function for processing a sub group
             *
             * @param {Prism} instance
             * @param {number} groupKey      index of group
             * @return {void}
             */
            function _processGroup(instance, groupKey) {
                const block = match[groupKey];

                // If there is no match here then move on
                if (!block) {
                    return;
                }

                const group = pattern.matches[groupKey];
                const language = group.language;

                /**
                 * Process group is what group we should use to actually process
                 * this match group.
                 *
                 * For example if the subgroup pattern looks like this:
                 *
                 * 2: {
                 *     'name': 'keyword',
                 *     'pattern': /true/g
                 * }
                 *
                 * then we use that as is, but if it looks like this:
                 *
                 * 2: {
                 *     'name': 'keyword',
                 *     'matches': {
                 *          'name': 'special',
                 *          'pattern': /whatever/g
                 *      }
                 * }
                 *
                 * we treat the 'matches' part as the pattern and keep
                 * the name around to wrap it with later
                 */
                const groupToProcess = group.name && group.matches ? group.matches : group;

                /**
                 * Takes the code block matched at this group, replaces it
                 * with the highlighted block, and optionally wraps it with
                 * a span with a name
                 *
                 * @param {string} passedBlock
                 * @param {string} replaceBlock
                 * @param {string|null} matchName
                 */
                const _getReplacement = function(passedBlock, replaceBlock, matchName) {
                    replacement = replaceAtPosition(indexOfGroup(match, groupKey), passedBlock, matchName ? _wrapCodeInSpan(matchName, replaceBlock) : replaceBlock, replacement);
                    return;
                };

                // If this is a string then this match is directly mapped
                // to selector so all we have to do is wrap it in a span
                // and continue.
                if (typeof group === 'string') {
                    _getReplacement(block, block, group);
                    return;
                }

                let localCode;
                const prism = new Prism(instance.patterns);

                // If this is a sublanguage go and process the block using
                // that language
                if (language) {
                    localCode = prism.refract(block, language);
                    _getReplacement(block, localCode);
                    return;
                }

                // The process group can be a single pattern or an array of
                // patterns. `_processCodeWithPatterns` always expects an array
                // so we convert it here.
                localCode = prism.refract(block, currentLanguage, groupToProcess.length ? groupToProcess : [groupToProcess]);
                _getReplacement(block, localCode, group.matches ? group.name : 0);
            }

            // If this pattern has sub matches for different groups in the regex
            // then we should process them one at a time by running them through
            // the _processGroup function to generate the new replacement.
            //
            // We use the `keys` function to run through them backwards because
            // the match position of earlier matches will not change depending
            // on what gets replaced in later matches.
            const groupKeys = keys(pattern.matches);
            for (const groupKey of groupKeys) {
                _processGroup(instance, groupKey);
            }

            // Finally, call `onMatchSuccess` with the replacement
            return onMatchSuccess(replacement);
        }

        /**
         * Processes a block of code using specified patterns
         *
         * @param {string} code
         * @return {string}
         */
        function _processCodeWithPatterns(code) {
            for (const pattern of this.patterns) {
                let result = _processPattern(this, pattern, code);
                while (result) {
                    result = _processPattern(this, pattern, result.remaining, result.offset);
                }
            }

            // We are done processing the patterns so we should actually replace
            // what needs to be replaced in the code.
            return _processReplacements(code);
        }

        this.refract = _processCodeWithPatterns;
    }
}
