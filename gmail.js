/*
 * Copyright (c) 2012 Adam Jabłooński
 *
 * Gmail Notify Extension is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * Gmail Notify Extension is distributed in the hope that it will be useful, but
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
const Me = imports.misc.extensionUtils.getCurrentExtension();
const TlsConn = Me.imports.tlsconnection;
const Imap = Me.imports.imap;
const OAuth = Me.imports.oauth;
const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Lang = imports.lang;
const Soup = imports.gi.Soup;
const XML = Me.imports.rexml;
const sess = new Soup.SessionAsync();
const console = Me.imports.console.console;

Soup.Session.prototype.add_feature.call(sess, new Soup.ProxyResolverDefault());


try {
    const Goa = imports.gi.Goa;
}
catch (err) {
    console.log("Goa import error:" + err.message);
}

const _DEBUG = true;


const GmailConnection = function () {
    this._init.apply(this, arguments);
};

GmailConnection.prototype = {
    __proto__: TlsConn.TlsConnection.prototype,
    _init: function (account) {
        try {
            let sprovider = account.get_account().provider_name.toUpperCase();
            if (sprovider !== "GOOGLE" && sprovider !== "MICROSOFT ACCOUNT") {
                throw new Error('This is not Google/Windows Account')
            }
            this._oAccount = account;
            if (_DEBUG) console.log("Creating gmail conn .." + this._oAccount.get_account().id);
            if (_DEBUG) console.log("Creating gmail conn .." + this._oAccount.get_account().identity);
            this._oMail = this._oAccount.get_mail();
            if (_DEBUG) console.log("Omailuse tls: " + this._oMail.imap_use_tls);
            if (_DEBUG) console.log("Omailuse host: " + this._oMail.imap_host);
            TlsConn.TlsConnection.prototype._init.call(this, this._oMail.imap_host, 993, this._oMail.imap_use_tls)
        }
        catch (err) {
            console.log("gmailConnection.proto:" + err.message);
        }
    }

};

//dummy class to emulate imap;

function GmailHttps() {
    this._init.apply(this, arguments);
}

GmailHttps.prototype = {
    _init: function (account) {
        this.connected = true;
        this._oAccount = account;
    },
    _disconnect: function () {
        this.connected = false;
        this.emit('disconnected');
    }
};

Signals.addSignalMethods(GmailHttps.prototype);


function GmailImap() {
    this._init.apply(this, arguments);
}
GmailImap.prototype = {
    __proto__: Imap.Imap.prototype,
    _init: function (conn) {
        try {
            if (conn instanceof GmailConnection) {
                Imap.Imap.prototype._init.call(this, conn);
            }
            // must be goa object (account)
            else {
                let oconn = new GmailConnection(conn);
                Imap.Imap.prototype._init.call(this, oconn);
                if (_DEBUG) console.log("Imap created: .." + this._conn._oAccount.get_account().id);
            }
            this.authenticated = false;
            this._conn.connect('disconnected', Lang.bind(this, () => {
                this.authenticated = false;
            }))
        }
        catch (err) {
            console.log("gmailImap.proto:" + err.message);
        }
    },
    authenticate: function (account, service, callback) {

        try {
            if (_DEBUG) console.log('Entering authenticate...');
            if (this._conn.connected) {
                this._doauthenticate(account, service, callback)
            }
            else {
                if (_DEBUG) console.log('Not Connected...');
                const _acc = account;
                const _svr = service;
                const _call = callback;
                this._conn._connect(Lang.bind(this, () => {
                    this._doauthenticate(_acc, _svr, _call)
                }));
            }
        }
        catch (err) {
            console.log("authenticate: " + err.message)
        }
    },
    _doauthenticate: function (account, service, callback) {
        try {
            if (_DEBUG) console.log('Entering _doauthenticate...');
            let oAuth = new OAuth.OAuth(account, service);
            let auth_str = oAuth.oAuth_str;
            //if (_DEBUG) console.log('auth_string: '+auth_str);

            this._command("AUTHENTICATE XOAUTH2 " + auth_str + String.fromCharCode(13) + String.fromCharCode(10), false, Lang.bind(this, function (oGIMap, resp) {
                    if (_DEBUG) {
                        for (let i = 0; i < resp.length; i++) console.log(resp[i]);
                    }
                    if (this._commandOK(resp)) {
                        this.authenticated = true;
                        this._conn.newline = String.fromCharCode(13) + String.fromCharCode(10);
                        if (typeof(callback) !== 'undefined') {
                            callback.apply(this, [this, resp]);
                        }
                        this.emit('authenticated', true);
                    }
                    else {
                        if (typeof(callback) !== 'undefined') {
                            callback.apply(this, [this, resp, new Error('Authentication error')]);
                        }
                        this.emit('authenticated', false);
                    }
                })
            );
        }
        catch (err) {
            console.log("_doAuthenticate: " + err.message)
        }
    },
    scanInbox: function (callback) {

        try {
            if (_DEBUG) console.log('scanInbox: Imap mode');
            if (this.authenticated) {
                this._doScanInbox(callback);
            }
            else {
                if (_DEBUG) console.log('scanInbox: not authenticated');
                const _call = callback;

                this.authenticate(this._conn._oAccount, "https://mail.google.com/mail/b/" + this._conn._oMail.imap_user_name + "/imap/",

                    Lang.bind(this, () => {
                        this._doScanInbox(_call);
                    }))
            }
        }
        catch (err) {
            console.log("scanInbox: " + err.message)
        }

    },

    _doScanInbox: function (callback, i) {
        try {
            if (_DEBUG) console.log("doScan entry");
            this._scanFolder("INBOX", Lang.bind(this, function (oImap, resp, error) {
                if (_DEBUG) console.log("doScan callback i=");
                try {
                    if (typeof(callback) !== 'undefined') {
                        if (typeof(error) === 'undefined') {
                            callback.apply(this, [this, resp]);

                        }
                        else {

                            callback.apply(this, [this, resp, error]);
                        }

                    }
                    if (_DEBUG) console.log("doScan" + this.folders.length);

                    this.emit('inbox-scanned', resp, error)
                }
                catch (err) {
                    console.log("doScan :" + err.message)
                }
            }));
        }
        catch (err) {
            console.log("_doscanInbox: " + err.message)
        }
    }
};

Signals.addSignalMethods(GmailImap.prototype);
