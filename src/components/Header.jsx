// Import React hooks:
// - useState: for local search input, avatar image source, and dropdown open/close state
// - useEffect: to attach document click listener and keep user avatar synced
// - useRef: references the dropdown DOM element to detect outside clicks
import React, { useState, useEffect, useRef } from 'react';

/**
 * Header Component
 * Displays the top navigation bar containing:
 * - Search bar with input and search button
 * - User profile info and dropdown with Google Classroom sync & logout options
 * 
 * Props:
 * - userName: string, the currently logged-in user's first name (or 'Guest')
 * - userAvatar: string | null, URL of the user's Google profile picture (if available)
 * - isClassroomConnected: boolean, whether Google Classroom coursework sync is connected
 * - isSyncingClassroom: boolean, whether a sync is currently in progress
 * - onConnectClassroom: function, callback to connect or sync Google Classroom
 * - onDisconnectClassroom: function, callback to disconnect Google Classroom
 * - onSearch: function, callback invoked when user presses Enter or clicks search icon
 * - onLogout: function, callback invoked when user clicks "Log out"
 */
export default function Header({
  userName,
  userAvatar,
  isClassroomConnected = false,
  isSyncingClassroom = false,
  onConnectClassroom,
  onDisconnectClassroom,
  onSearch,
  onLogout,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false); // Controls whether the profile dropdown menu is open
  const [searchValue, setSearchValue] = useState('');      // Controlled input state for the search query
  const [avatarSrc, setAvatarSrc] = useState(userAvatar || '/Pictures/Gmail.png'); // Active avatar image source
  const dropdownRef = useRef(null);                        // DOM reference to the user dropdown wrapper

  // Keep avatar image synced when userAvatar prop updates (e.g. on login/logout)
  useEffect(() => {
    setAvatarSrc(userAvatar || '/Pictures/Gmail.png');
  }, [userAvatar]);

  // Close the profile dropdown menu if the user clicks anywhere outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Trigger search when user presses Enter in the input box
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSearch(searchValue);
      setSearchValue('');
    }
  };

  // Trigger search when user clicks the magnifying glass button
  const handleSearchClick = () => {
    onSearch(searchValue);
    setSearchValue('');
  };

  const isCustomAvatar = Boolean(userAvatar && avatarSrc !== '/Pictures/Gmail.png');

  // Format user display name so only the first letter is capitalized (e.g. 'Dharwin')
  const getCapitalizedFirstName = (name) => {
    if (!name || name === 'Guest') return 'Guest';
    let target = String(name).trim();
    // Handle "LastName, FirstName" format
    if (target.includes(',')) {
      const parts = target.split(',');
      target = (parts[1] && parts[1].trim()) ? parts[1].trim() : parts[0].trim();
    }
    const cleanWord = target.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '');
    if (!cleanWord) return 'Guest';
    return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
  };

  const displayName = getCapitalizedFirstName(userName);

  return (
    <header className="topbar">
      <table style={{ width: '100%' }}>
        <tbody>
          <tr>
            {/* Left column: Search bar */}
            <th className="searchCol">
              <div className="searchbar">
                <button
                  id="searchId"
                  className="searchButton"
                  type="button"
                  onClick={handleSearchClick}
                >
                  <img className="logo" src="/Pictures/Find.png" alt="Search" />
                </button>
                <input
                  id="searchTextId"
                  className="searchBox"
                  type="search"
                  placeholder="Search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </th>

            {/* Right column: User profile & logout dropdown */}
            <th className="profileCol">
              <div
                className={`user-dropdown ${dropdownOpen ? 'active' : ''}`}
                ref={dropdownRef}
              >
                {/* Profile pill button that toggles the dropdown */}
                <div
                  className="gmailp"
                  id="accountDropdownBtn"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                >
                  {/*
                    User avatar image:
                    - Uses Google account avatar if logged in with Google
                    - Falls back to /Pictures/Gmail.png for guest or onError
                    - referrerPolicy="no-referrer" protects user privacy and prevents data leakage
                  */}
                  <img
                    className={`logo ${isCustomAvatar ? 'user-avatar' : ''}`}
                    src={avatarSrc}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarSrc('/Pictures/Gmail.png')}
                  />
                  <b id="accountName">{displayName}</b>
                  <i className="fa-solid fa-chevron-down dropdown-arrow"></i>
                </div>

                {/* Dropdown menu */}
                <div className="dropdown-menu" id="accountDropdownMenu">
                  {/* Google Classroom Connect / Sync action */}
                  <button
                    id="classroomSyncBtn"
                    className="dropdown-item classroom-item"
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onConnectClassroom) onConnectClassroom();
                    }}
                    disabled={isSyncingClassroom}
                  >
                    <img
                      src="/Pictures/GoogleClassroom.svg"
                      alt=""
                      className="classroom-dropdown-icon"
                    />
                    {isSyncingClassroom
                      ? 'Syncing...'
                      : isClassroomConnected
                      ? 'Sync Classroom'
                      : 'Connect to Google Classroom'}
                  </button>

                  {/* Option to disconnect Google Classroom */}
                  {isClassroomConnected && (
                    <button
                      id="classroomDisconnectBtn"
                      className="dropdown-item"
                      style={{ color: '#666', fontSize: '13px' }}
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        if (onDisconnectClassroom) onDisconnectClassroom();
                      }}
                    >
                      <i className="fa-solid fa-link-slash"></i> Disconnect
                    </button>
                  )}

                  <div className="dropdown-divider"></div>

                  <button
                    id="logoutBtn"
                    className="dropdown-item"
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                  >
                    <i className="fa-solid fa-right-from-bracket"></i> Log out
                  </button>
                </div>
              </div>
            </th>
          </tr>
        </tbody>
      </table>
    </header>
  );
}
