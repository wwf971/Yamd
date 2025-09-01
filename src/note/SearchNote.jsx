import React, { useState, useEffect, useRef } from 'react';
import { useNoteStore } from '@/Note.js';
import './SearchNote.css';

const SearchNote = ({ onNoteSelect }) => {
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState([]);
	const [isSearching, setIsSearching] = useState(false);
	const [currentQueryStr, setCurrentQueryStr] = useState('');
	const [showResults, setShowResults] = useState(false);
	
	const searchNoteById = useNoteStore(state => state.searchNoteById);
	const timeoutRef = useRef(null);
	const containerRef = useRef(null);

	// Debounced search with race condition handling
	useEffect(() => {
		// Clear previous timeout
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		// If search query is empty, clear results
		if (!searchQuery.trim()) {
			setSearchResults([]);
			setCurrentQueryStr('');
			setShowResults(false);
			return;
		}

		// Set new timeout for debounced search
		timeoutRef.current = setTimeout(async () => {
			setIsSearching(true);
			const queryToSearch = searchQuery.trim();
			
			try {
				const result = await searchNoteById(queryToSearch);
				
				// Only update results if this is still the latest query
				if (result.query_str === queryToSearch) {
					setCurrentQueryStr(queryToSearch);
					if (result.is_success) {
						setSearchResults(result.data || []);
						setShowResults(true);
					} else {
						setSearchResults([]);
						setShowResults(false);
						console.error('Search failed:', result.message);
					}
				}
			} catch (error) {
				console.error('Search error:', error);
				setSearchResults([]);
				setShowResults(false);
			} finally {
				setIsSearching(false);
			}
		}, 300); // 300ms delay

		// Cleanup function
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [searchQuery, searchNoteById]);

	// Handle click outside to hide results
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (containerRef.current && !containerRef.current.contains(event.target)) {
				setShowResults(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	// Show results when input is focused and has content
	const handleInputFocus = () => {
		if (searchQuery.trim() && searchResults.length > 0) {
			setShowResults(true);
		}
	};

	const handleResultClick = (noteId) => {
		if (onNoteSelect) {
			onNoteSelect(noteId);
		}
		// Hide results after selection
		setShowResults(false);
	};

	const highlightMatches = (text, startIndices, endIndices) => {
		if (!startIndices || !endIndices || startIndices.length === 0) return text;
		
		// Create pairs of start and end indices
		const matchPairs = startIndices.map((start, i) => ({
			start,
			end: endIndices[i] || start + 1
		}));
		
		// Sort by start index
		matchPairs.sort((a, b) => a.start - b.start);
		
		// Merge overlapping ranges
		const mergedRanges = [];
		for (const range of matchPairs) {
			if (mergedRanges.length === 0) {
				mergedRanges.push(range);
			} else {
				const lastRange = mergedRanges[mergedRanges.length - 1];
				if (range.start <= lastRange.end) {
					// Overlapping or adjacent ranges - merge them
					lastRange.end = Math.max(lastRange.end, range.end);
				} else {
					// Non-overlapping range
					mergedRanges.push(range);
				}
			}
		}
		
		// Apply highlights in reverse order to avoid index shifting
		mergedRanges.reverse();
		
		let result = text;
		mergedRanges.forEach(({ start, end }) => {
			const before = result.substring(0, start);
			const match = result.substring(start, end);
			const after = result.substring(end);
			result = before + `<mark>${match}</mark>` + after;
		});
		
		return result;
	};

	return (
		<div className="search-note-container" ref={containerRef}>
			<div className="search-input-container">
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					onFocus={handleInputFocus}
					placeholder="Search notes by ID..."
					className="search-input"
				/>
				{isSearching && <span className="search-loading">🔍</span>}
			</div>
			
			{showResults && searchResults.length > 0 && (
				<div className="search-results">
					<div className="search-results-header">
						Found {searchResults.length} note(s) for "{currentQueryStr}"
					</div>
					{searchResults.map((result, index) => (
						<div
							key={index}
							className="search-result-item"
							onClick={() => handleResultClick(result.id)}
						>
							<div className="search-result-id">
								<strong>ID:</strong> 
								<span 
									dangerouslySetInnerHTML={{
										__html: highlightMatches(
											result.id,
											result.matched_keys?.[0]?.start_index || [],
											result.matched_keys?.[0]?.end_index || []
										)
									}}
								/>
							</div>
							<div className="search-result-meta">
								{result.type && (
									<span className="search-result-type-tag">
										{result.type}
									</span>
								)}
								{result.relevance_score && (
									<span className="search-result-score">
										{result.relevance_score} matches
									</span>
								)}
							</div>
						</div>
					))}
				</div>
			)}
			
			{showResults && searchQuery.trim() && searchResults.length === 0 && !isSearching && (
				<div className="search-no-results">
					No notes found for "{currentQueryStr}"
				</div>
			)}
		</div>
	);
};

export default SearchNote;
