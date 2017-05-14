/*
 * Copyright (c) 2012 Adam Jabłoński
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
const St = imports.gi.St;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Lang = imports.lang;
const _DEBUG = true;
const extension = Me.imports.extension;
const GmailNotification = Me.imports.GmailNotification.GmailNotification;
const GmailNotificationSource = Me.imports.GmailNotificationSource.GmailNotificationSource;
const console = Me.imports.console.console;


const GmailMessageTray = new Lang.Class({
    Name: 'GmailMessageTray',
    _init: function (numMessages, numUnread, mailbox) {
        this.numMessages = numMessages;
        this.numUnread = numUnread;
        this.mailbox = mailbox;
        this.emailSummaryNotification = null;
    },
    _createNotification: function (content, iconName, popUp) {
        const source = new GmailNotificationSource();
        Main.messageTray.add(source);
        const notification = new GmailNotification(source, content, iconName);
        if (popUp) {
            notification.setResident(true);
            source.notify(notification);
        } else {
            source.pushNotification(notification);
        }
        notification.connect('activated', () => {
            if (notification === this.emailSummaryNotification) {
                Main.panel.statusArea.dateMenu.menu.open();
            } else {
                this.numUnread--;
                const emailSummary = this._createEmailSummary(this.mailbox);
                this.emailSummaryNotification.update(emailSummary.subject, emailSummary.from);
                this._openEmail(content.link);
            }
        });
        return notification;
    },
    _browseGn: function () {
        const config = extension.config;
        if (config._browser === "") {
            console.log("gmail notify: no default browser")
        }
        else {
            Util.trySpawnCommandLine(config._browser + " http://gn.makrodata.org");
        }
    },

    _showNoMessage: function (from) {
        try {
            const content = {
                from,
                date: new Date(),
                subject: _('No new messages')
            };
            this._createNotification(content, "mail-read", false);
        } catch (err) {
            console.error(err);
        }
    },
    _showError: function (err) {
        const subject = _(err);
        const content = {
            from: "",
            date: new Date(),
            subject
        };
        this._createNotification(content, "mail-mark-important", true);
    },
    _createEmailSummary(){
        return {
            from: this.mailbox,
            date: new Date(),
            subject: `${this.numMessages} messages (${this.numUnread} unread)`
        };
    },
    _showEmailSummaryNotification(){
        return this._createNotification(this._createEmailSummary(), "mail-mark-important", true);
    },
    setContent: function (content) {
        try {
            if (content !== undefined) {
                if (content.length > 0) {
                    for (let msg of content) {
                        this._createNotification(msg, "mail-unread", false);
                    }
                    this.emailSummaryNotification = this._showEmailSummaryNotification();
                }
                else {
                    this._showNoMessage();
                }
            }
            else {
                this._showNoMessage();
            }
            if (extension.nVersion > extension._version) {
                const content = {
                    from: "Gmail Message Tray",
                    date: new Date(),
                    subject: _('There is newer version of this extension: %s - click to download').format(extension.nVersion)
                };
                this._createNotification(content, "mail-mark-important", true);
            }

        } catch (err) {
            console.error(err);
        }
    },

    _openEmail: function (link) {
        const config = extension.config;
        try {
            if (config.getReader() === 0) {
                if (config._browser === "") {
                    console.log("no default browser")
                }
                else {
                    console.log("link: " + link);
                    if (link !== '' && link !== undefined) {
                        Util.trySpawnCommandLine(config._browser + " " + link);
                    }
                    else {
                        Util.trySpawnCommandLine(config._browser + " http://www.gmail.com");
                    }
                }
            } else {
                if (config._mail === "") {
                    console.log("no default mail reader")
                }
                else {
                    Util.trySpawnCommandLine(config._mail);
                }
            }

        }
        catch (err) {
            console.error(err);
        }
    }
});

