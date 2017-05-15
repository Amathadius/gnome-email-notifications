/*
 * Copyright (c) 2012 Adam Jabłooński
 *
 * Gmail Message Tray Extension is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * Gmail Message Tray Extension is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with Gnome Documents; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Authors:
 * Adam Jabłoński <jablona123@gmail.com>
 * Shuming Chan <shuming0207@gmail.com>
 *
 */
"use strict";
const Me = imports.misc.extensionUtils.getCurrentExtension();
const OAuth = Me.imports.oauth;
const XML = Me.imports.rexml;
const Soup = imports.gi.Soup;
const Sess = new Soup.SessionAsync();
const console = Me.imports.console.console;
const _DEBUG = false;


function GmailFeed() {
    this._init.apply(this, arguments);
}

GmailFeed.prototype = {
    _init: function (conn) {
        this._conn = conn;
        this.folders = [];
    },
    scanInbox: function (callback) {
        const sprovider = this._conn.get_account().provider_name.toUpperCase();
        if (sprovider !== "GOOGLE") {
            if (_DEBUG) console.log('feed provider:' + sprovider);
            return;
        }
        const service = "https://mail.google.com/mail/feed/atom/inbox";
        const oAuth = new OAuth.OAuth(this._conn, service);
        if (_DEBUG) console.log('auth req', oAuth.oAuth_auth);
        if (_DEBUG) console.log('OAuth ' + oAuth.acc_token[1]);
        const msg = Soup.Message.new("GET", service);
        msg.request_headers.append('Authorization', 'OAuth ' + oAuth.acc_token[1]);
        Sess.queue_message(msg, (sess, msg) => {
            if (_DEBUG) console.log('Message status:' + msg.status_code);
            if (msg.status_code === 200) {
                this.folders = [];
                const messages = [];
                const xmltx = msg.response_body.data.substr(msg.response_body.data.indexOf('>') + 1).replace('xmlns="http://purl.org/atom/ns#"', '');
                const oxml = new XML.REXML(xmltx);

                if (_DEBUG) console.log('xml name:' + oxml.rootElement.name);
                let i = 0;
                let cnt = 0;
                while (typeof(oxml.rootElement.childElements[i]) !== 'undefined') {
                    if (_DEBUG) console.log('child name:' + oxml.rootElement.childElements[i].name);
                    if (oxml.rootElement.childElements[i].name === 'entry') {
                        let entry = oxml.rootElement.childElements[i];
                        let em = {
                            from: `${entry.childElement('author').childElement('name').text} <${entry.childElement('author').childElement('email').text}>`,
                            id: i,
                            subject: entry.childElement('title').text,
                            date: entry.childElement('modified').text,
                            link: entry.childElement('link').attribute('href').replace(/&amp;/g, '&'),
                            safeid: entry.childElement('id').text,
                        };
                        messages.push(em);
                        cnt++;
                    }
                    i++;
                }
                this.folders.push({
                    name: 'inbox',
                    encoded: 'inbox',
                    messages: cnt,
                    unseen: cnt,
                    list: messages
                });
                callback(this);
            }
            else {
                if (_DEBUG) console.log('Message body:' + msg.response_body.data);
                throw new Error('Google connection Status: ' + msg.status + ' ' + msg.message_body.data);
            }
        });
    }
};
