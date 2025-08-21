import { test as base, expect } from '@playwright/test';
import { Service, Query, QueryColumn } from "@vidyano/core";

type Fixtures = {
    service: Service;
    peopleQuery: Query;
};

function parseDistinctValue(distinct: string) {
    if (!distinct) return { value: '', display: '' };
    
    const pipeIndex = distinct.indexOf('|');
    if (pipeIndex === -1) return { value: distinct, display: distinct };
    
    const lengthStr = distinct.substring(0, pipeIndex);
    const remainder = distinct.substring(pipeIndex + 1);
    
    if (lengthStr === '') {
        return { value: remainder, display: remainder };
    }
    
    const length = parseInt(lengthStr, 10);
    if (isNaN(length)) return { value: remainder, display: remainder };
    
    const value = remainder.substring(0, length);
    const display = remainder.substring(length) || value;
    
    return { value, display };
}

function buildFilterValue(value: string, isTextSearch = false) {
    return isTextSearch ? `1|@${value}` : `|${value}`;
}

const test = base.extend<Fixtures>({
    service: async ({}, use) => {
        const service = new Service("http://localhost:5000", undefined, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await service.executeAction("PersistentObject.ResetTest", service.application);
        await use(service);
    },
    peopleQuery: async ({ service }, use) => {
        const query = await service.getQuery("People", { textSearch: "FirstName:A*", });
        await use(query);
    },
});

test.describe('Query Filters and Distincts', () => {
    test.describe('Basic Filtering Patterns', () => {
        test('filters query with exact value', async ({ peopleQuery }) => {
            const initialCount = peopleQuery.totalItems;
            expect(initialCount).toBeGreaterThan(0);

            const genderColumn = peopleQuery.columns.find(c => c.name === 'Gender')!;
            expect(genderColumn).toBeInstanceOf(QueryColumn);
            expect(genderColumn.canFilter).toBe(true);
            
            genderColumn.selectedDistincts = ['|Female'];
            await peopleQuery.search();

            const allAreFemale = await peopleQuery.items.everyAsync(item => 
                item.values['Gender'] === 'Female'
            );

            expect(genderColumn.selectedDistincts).toEqual(['|Female']);
            expect(peopleQuery.totalItems).toBeLessThanOrEqual(initialCount);
            expect(peopleQuery.totalItems).toBeGreaterThan(0);
            expect(allAreFemale).toBe(true);
        });

        test('filters with text search', async ({ peopleQuery }) => {
            const firstNameColumn = peopleQuery.columns.find(c => c.name === 'FirstName')!;
            expect(firstNameColumn).toBeInstanceOf(QueryColumn);
            
            firstNameColumn.selectedDistincts = ['1|@An'];
            await peopleQuery.search();

            const allMatchFilter = await peopleQuery.items.everyAsync(item => {
                const firstName = item.values['FirstName'];
                return firstName && firstName.startsWith('An');
            });

            expect(peopleQuery.totalItems).toBeGreaterThan(0);
            expect(allMatchFilter).toBe(true);
        });

        test('supports include vs exclude mode', async ({ peopleQuery }) => {
            const genderColumn = peopleQuery.columns.find(c => c.name === 'Gender')!;
            expect(genderColumn).toBeInstanceOf(QueryColumn);

            genderColumn.selectedDistincts = ['|Female'];
            genderColumn.selectedDistinctsInversed = false;
            await peopleQuery.search();
            const includeCount = peopleQuery.totalItems;
            const includeHasFemales = await peopleQuery.items.someAsync(item => 
                item?.values['Gender'] === 'Female'
            );

            genderColumn.selectedDistincts = ['|Female'];
            genderColumn.selectedDistinctsInversed = true;
            await peopleQuery.search();
            const excludeCount = peopleQuery.totalItems;
            const excludeHasFemales = await peopleQuery.items.someAsync(item => 
                item?.values['Gender'] === 'Female'
            );

            expect(includeCount).toBeGreaterThan(0);
            expect(excludeCount).toBeGreaterThan(0);
            expect(includeHasFemales).toBe(true);
            expect(excludeHasFemales).toBe(false);
            expect(includeCount).not.toBe(excludeCount);
        });
    });

    test.describe('Building Filter UIs', () => {
        test('loads distincts for user selection', async ({ peopleQuery }) => {
            const genderColumn = peopleQuery.columns.find(c => c.name === 'Gender')!;
            expect(genderColumn).toBeInstanceOf(QueryColumn);
            
            await genderColumn.refreshDistincts();

            const allOptions = [
                ...(genderColumn.distincts.matching || []),
                ...(genderColumn.distincts.remaining || [])
            ];

            const dropdownOptions = allOptions.map(distinct => {
                const parsed = parseDistinctValue(distinct);
                return {
                    value: parsed.value,
                    label: parsed.display || parsed.value
                };
            });

            expect(allOptions.length).toBeGreaterThan(0);
            expect(Array.isArray(genderColumn.distincts.matching)).toBe(true);
            expect(Array.isArray(genderColumn.distincts.remaining)).toBe(true);
            expect(genderColumn.distincts.isDirty).toBe(false);
            expect(genderColumn.distincts.hasMore).toBe(null);
            expect(dropdownOptions.length).toBeGreaterThan(0);
            expect(dropdownOptions.some(opt => opt.value === 'Male')).toBe(true);
            expect(dropdownOptions.some(opt => opt.value === 'Female')).toBe(true);
        });

        test('handles hasMore in distincts', async ({ peopleQuery }) => {
            const birthDateColumn = peopleQuery.columns.find(c => c.name === 'BirthDate')!;
            expect(birthDateColumn).toBeInstanceOf(QueryColumn);
            
            await birthDateColumn.refreshDistincts();

            expect(birthDateColumn.distincts.hasMore).toBe(true);
            expect(birthDateColumn.distincts.matching.length).toBeGreaterThan(0);
            expect(birthDateColumn.distincts.remaining.length).toBe(0);
        });

        test('supports multi-selection filtering', async ({ peopleQuery }) => {
            const genderColumn = peopleQuery.columns.find(c => c.name === 'Gender')!;
            expect(genderColumn).toBeInstanceOf(QueryColumn);
            
            const selectedGenders = ['|Male', '|Female'];
            genderColumn.selectedDistincts = selectedGenders;
            await peopleQuery.search();
            
            const includeCount = peopleQuery.totalItems;
            const includeItems = await peopleQuery.items.filterAsync(item => item != null);
            const includeValues = [...new Set(includeItems.map(item => item.values['Gender']))];

            genderColumn.selectedDistincts = ['|Unknown'];
            genderColumn.selectedDistinctsInversed = true;
            await peopleQuery.search();
            
            const excludeHasUnknown = await peopleQuery.items.someAsync(item => 
                item?.values['Gender'] === 'Unknown'
            );

            expect(includeCount).toBeGreaterThan(0);
            expect(includeValues.every(v => ['Male', 'Female'].includes(v))).toBe(true);
            expect(excludeHasUnknown).toBe(false);
        });
    });

    test.describe('Advanced Text Search', () => {
        test('searches string columns', async ({ peopleQuery }) => {
            const firstNameColumn = peopleQuery.columns.find(c => c.name === 'FirstName')!;
            expect(firstNameColumn).toBeInstanceOf(QueryColumn);

            firstNameColumn.selectedDistincts = ['1|@Al'];
            await peopleQuery.search();

            const allMatchFilter = await peopleQuery.items.everyAsync(item => {
                const firstName = item.values['FirstName'];
                return firstName && firstName.startsWith('Al');
            });

            expect(peopleQuery.totalItems).toBeGreaterThan(0);
            expect(allMatchFilter).toBe(true);
        });

        test('searches date columns', async ({ peopleQuery }) => {
            const birthDateColumn = peopleQuery.columns.find(c => c.name === 'BirthDate')!;
            expect(birthDateColumn).toBeInstanceOf(QueryColumn);

            birthDateColumn.selectedDistincts = ['1|@1985'];
            await peopleQuery.search();
            const year1985Count = peopleQuery.totalItems;
            const all1985 = await peopleQuery.items.everyAsync(item => {
                const birthDate = item.values['BirthDate'];
                return birthDate && new Date(birthDate).getFullYear() === 1985;
            });

            birthDateColumn.selectedDistincts = ['1|@3/1985'];
            await peopleQuery.search();
            const march1985Count = peopleQuery.totalItems;
            const allMarch1985 = await peopleQuery.items.everyAsync(item => {
                const birthDate = item.values['BirthDate'];
                return birthDate && new Date(birthDate).getFullYear() === 1985 && new Date(birthDate).getMonth() === 2;
            });

            expect(year1985Count).toBeGreaterThan(0);
            expect(all1985).toBe(true);
            expect(march1985Count).toBeGreaterThan(0);
            expect(allMarch1985).toBe(true);
        });

        test('searches with string patterns', async ({ peopleQuery }) => {
            const emailColumn = peopleQuery.columns.find(c => c.name === 'Email')!;
            expect(emailColumn).toBeInstanceOf(QueryColumn);

            emailColumn.selectedDistincts = ['1|@a'];
            await peopleQuery.search();
            const aCount = peopleQuery.totalItems;
            const allStartWithA = await peopleQuery.items.everyAsync(item => {
                const email = item.values['Email'];
                return email && email.toLowerCase().startsWith('a');
            });

            emailColumn.selectedDistincts = ['1|@al'];
            await peopleQuery.search();
            const alCount = peopleQuery.totalItems;
            const allStartWithAl = await peopleQuery.items.everyAsync(item => {
                const email = item.values['Email'];
                return email && email.toLowerCase().startsWith('al');
            });

            expect(aCount).toBeGreaterThan(0);
            expect(allStartWithA).toBe(true);
            expect(alCount).toBeGreaterThan(0);
            expect(allStartWithAl).toBe(true);
        });

        test('combines multiple search terms', async ({ peopleQuery }) => {
            const firstNameColumn = peopleQuery.columns.find(c => c.name === 'FirstName')!;
            expect(firstNameColumn).toBeInstanceOf(QueryColumn);

            firstNameColumn.selectedDistincts = ['1|@Al', '1|@An', '1|@Ar'];
            await peopleQuery.search();

            const allMatchTerms = await peopleQuery.items.everyAsync(item => {
                const firstName = item.values['FirstName'];
                return firstName && (
                    firstName.startsWith('Al') || 
                    firstName.startsWith('An') || 
                    firstName.startsWith('Ar')
                );
            });
            
            expect(peopleQuery.totalItems).toBeGreaterThan(0);
            expect(allMatchTerms).toBe(true);
        });
    });

    test.describe('Working with Distinct Values', () => {
        test('parses distinct values correctly', async () => {
            const tests = [
                { input: "|Male", expected: { value: "Male", display: "Male" } },
                { input: "|Female", expected: { value: "Female", display: "Female" } },
                { input: "4|TrueYes", expected: { value: "True", display: "Yes" } },
                { input: "5|FalseFalse", expected: { value: "False", display: "False" } },
                { input: "5|john@John Doe", expected: { value: "john@", display: "John Doe" } }
            ];

            tests.forEach(testCase => {
                expect(parseDistinctValue(testCase.input)).toEqual(testCase.expected);
            });
        });

        test('builds filter values correctly', async () => {
            const tests = [
                { value: 'Male', isTextSearch: false, expected: '|Male' },
                { value: 'John', isTextSearch: true, expected: '1|@John' },
                { value: 'True', isTextSearch: false, expected: '|True' }
            ];

            tests.forEach(testCase => {
                expect(buildFilterValue(testCase.value, testCase.isTextSearch)).toBe(testCase.expected);
            });
        });
    });

    test.describe('Advanced Filtering Patterns', () => {
        test('supports multi-column filtering with AND logic', async ({ peopleQuery }) => {
            const initialCount = peopleQuery.totalItems;

            const genderColumn = peopleQuery.columns.find(c => c.name === 'Gender')!;
            const activeColumn = peopleQuery.columns.find(c => c.name === 'IsActive')!;
            const birthDateColumn = peopleQuery.columns.find(c => c.name === 'BirthDate')!;
            
            expect(genderColumn).toBeInstanceOf(QueryColumn);
            expect(activeColumn).toBeInstanceOf(QueryColumn);
            expect(birthDateColumn).toBeInstanceOf(QueryColumn);

            genderColumn.selectedDistincts = ['|Female'];
            activeColumn.selectedDistincts = ['|True'];
            birthDateColumn.selectedDistincts = ['1|@1985'];

            await peopleQuery.search();

            const allMatch = await peopleQuery.items.everyAsync(item => {
                const gender = item.values['Gender'];
                const isActive = item.values['IsActive'];
                const birthDate = item.values['BirthDate'];
                
                return gender === 'Female' && 
                       isActive === true && 
                       birthDate && new Date(birthDate).getFullYear() === 1985;
            });

            expect(peopleQuery.totalItems).toBeLessThanOrEqual(initialCount);
            expect(peopleQuery.totalItems).toBeGreaterThan(0);
            expect(allMatch).toBe(true);
        });

        test('supports complex filter combinations', async ({ peopleQuery }) => {
            const firstNameColumn = peopleQuery.columns.find(c => c.name === 'FirstName')!;
            const genderColumn = peopleQuery.columns.find(c => c.name === 'Gender')!;
            const emailColumn = peopleQuery.columns.find(c => c.name === 'Email')!;
            
            expect(firstNameColumn).toBeInstanceOf(QueryColumn);
            expect(genderColumn).toBeInstanceOf(QueryColumn);
            expect(emailColumn).toBeInstanceOf(QueryColumn);
            
            firstNameColumn.selectedDistincts = ['|Alice', '|Anna', '|Amy'];

            genderColumn.selectedDistincts = ['|Unknown'];
            genderColumn.selectedDistinctsInversed = true;

            emailColumn.selectedDistincts = ['1|@a'];

            await peopleQuery.search();

            const allMatch = await peopleQuery.items.everyAsync(item => {
                // Skip null items that aren't loaded yet
                if (!item) return true;
                
                const firstName = item.values['FirstName'];
                const gender = item.values['Gender'];
                const email = item.values['Email'];
                
                const nameMatch = firstName && ['Alice', 'Anna', 'Amy'].includes(firstName);
                const genderMatch = gender !== 'Unknown';
                const emailMatch = email && email.toLowerCase().startsWith('a');
                
                return nameMatch && genderMatch && emailMatch;
            });

            expect(peopleQuery.totalItems).toBeGreaterThan(0);
            expect(allMatch).toBe(true);
        });
    });

    test.describe('Practical Recipes', () => {
        test('filters by age range', async ({ peopleQuery }) => {
            const birthDateColumn = peopleQuery.columns.find(c => c.name === 'BirthDate')!;
            expect(birthDateColumn).toBeInstanceOf(QueryColumn);

            const currentYear = new Date().getFullYear();
            const minBirthYear = currentYear - 35;
            const maxBirthYear = currentYear - 25;
            
            const searchTerms: string[] = [];
            for (let year = minBirthYear; year <= maxBirthYear; year++) {
                searchTerms.push(`1|@${year}`);
            }
            
            birthDateColumn.selectedDistincts = searchTerms;
            await peopleQuery.search();

            const allInRange = await peopleQuery.items.everyAsync(item => {
                const birthDate = item.values['BirthDate'];
                return birthDate && 
                       currentYear - new Date(birthDate).getFullYear() >= 25 && 
                       currentYear - new Date(birthDate).getFullYear() <= 35;
            });

            expect(peopleQuery.totalItems).toBeGreaterThan(0);
            expect(allInRange).toBe(true);
        });

        test('clears all filters', async ({ peopleQuery }) => {
            const genderColumn = peopleQuery.columns.find(c => c.name === 'Gender')!;
            const activeColumn = peopleQuery.columns.find(c => c.name === 'IsActive')!;
            
            expect(genderColumn).toBeInstanceOf(QueryColumn);
            expect(activeColumn).toBeInstanceOf(QueryColumn);
            
            genderColumn.selectedDistincts = ['|Male'];
            activeColumn.selectedDistincts = ['|True'];
            await peopleQuery.search();
            const filteredCount = peopleQuery.totalItems;

            peopleQuery.columns.forEach(col => {
                col.selectedDistincts = [];
                col.selectedDistinctsInversed = false;
            });
            
            await peopleQuery.search();
            const clearedCount = peopleQuery.totalItems;

            const anyFiltersActive = peopleQuery.columns.some(col => 
                col.selectedDistincts && col.selectedDistincts.length > 0
            );

            expect(anyFiltersActive).toBe(false);
            expect(filteredCount).toBeGreaterThan(0);
            expect(clearedCount).toBeGreaterThan(filteredCount);
        });
    });

    test.describe('Performance Best Practices', () => {
        test('batches filter changes for performance', async ({ peopleQuery }) => {
            let searchCalls = 0;
            const originalSearch = peopleQuery.search.bind(peopleQuery);
            peopleQuery.search = async function(...args) {
                searchCalls++;
                return originalSearch(...args);
            };

            const genderColumn = peopleQuery.columns.find(c => c.name === 'Gender')!;
            const activeColumn = peopleQuery.columns.find(c => c.name === 'IsActive')!;
            const birthDateColumn = peopleQuery.columns.find(c => c.name === 'BirthDate')!;
            
            expect(genderColumn).toBeInstanceOf(QueryColumn);
            expect(activeColumn).toBeInstanceOf(QueryColumn);
            expect(birthDateColumn).toBeInstanceOf(QueryColumn);

            genderColumn.selectedDistincts = ['|Male'];
            activeColumn.selectedDistincts = ['|True'];
            birthDateColumn.selectedDistincts = ['1|@1985'];
            await peopleQuery.search();

            expect(searchCalls).toBe(1);
        });

        test('checks canFilter before applying filters', async ({ peopleQuery }) => {
            const filterableColumns = peopleQuery.columns.filter(column => column.canFilter);
            expect(filterableColumns.length).toBeGreaterThan(0);
        });
    });
});