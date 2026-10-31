import { c } from './types';
import type { CardText } from './types';

const lotteryResults = [
  'Nothing. As usual.',
  'You get your money back. It feels like winning.',
  'A small prize. Dinner is on you.',
  'A proper prize. You check the number three times.',
  'A big one. Your hands are shaking.',
  'The jackpot. You sit down on the kitchen floor.',
];

export const cards: Record<string, CardText> = {
  // Career
  career_raise: c('Ask for a raise', 'Your review is next week and your rent went up twice since the last one.', [
    'Say nothing',
    ['Ask for it', 'They say yes, and faster than you expected.', 'A warm smile and "not this cycle".', 'It lands badly. People noticed.'],
    ['Build a case first', 'Numbers on the table. They sign.', 'A good case, a frozen budget.'],
    ['Negotiate it properly', 'You knew your number and you got it.', 'Not all of it. More than they meant to give.'],
  ]),
  career_competitor_offer: c('A competitor calls', 'The rival across town wants you, and they are offering more.', [
    'Stay loyal',
    'Take the job',
    ['Show it to your boss', 'A counter-offer arrives by lunch.', 'Your boss wishes you luck. You stay, awkwardly.', 'You are now "a flight risk". The bonus pool forgets you.'],
  ]),
  career_relocation: c('Promotion, with a catch', 'The step up is yours. The desk is in {city:london}.', [
    'Turn it down',
    'Pack your bags',
  ]),
  career_transfer_east: c('An office in the east', 'The firm is opening desks in {city:tokyo} and {city:moscow}, and wants someone who knows the work.', [
    'Stay where you are',
    'Go to {city:tokyo}',
    'Go to {city:moscow}',
  ]),
  career_transfer_west: c('An office in the west', 'Two openings, both paid for: one in {city:mexico_city}, one in {city:zurich}.', [
    'Stay where you are',
    'Go to {city:mexico_city}',
    'Go to {city:zurich}',
  ]),
  career_overtime_crunch: c('Crunch time', 'The deadline moved forward. Somebody has to stay late for a month.', [
    ['Do the minimum', 'Nobody notices.', 'Somebody noticed.'],
    'Put in the hours',
  ]),
  career_layoff: c('A round of layoffs', 'An all-hands meeting appears in your calendar with no agenda.', [
    'Take the severance',
    ['Fight for your seat', 'You survive the cut.', 'You are out anyway, with less in the envelope.'],
    'Retrain while you look',
  ]),
  career_toxic_boss: c('The new boss', 'Emails at midnight. Praise in private, blame in public.', [
    'Grit your teeth',
    ['Report it to HR', 'HR acts. People thank you in the corridor.', 'HR sides with the boss. Your next raise evaporates.'],
    'Move to another team',
  ]),
  career_switch: c('A different ladder', 'A friend in banking says they are hiring people with "real-world experience".', [
    'Stay where you are',
    'Start at the bottom in finance',
    ['Pay for a course and apply', 'You get the offer.', 'Forty applications, no offer.'],
  ]),
  career_big_offer: c('The big name', '{brand:google}, {brand:inditex} or {brand:goldman_sachs}: whoever rules your field wants to talk.', [
    'Stay put',
    'Accept the offer',
    ['Negotiate hard', 'They meet your number.', 'They withdraw the offer.'],
  ]),
  career_shares_vs_salary: c('Shares or salary', 'Your raise can come as cash every month or as shares that vest in two years.', [
    'Take the cash',
    ['Take the shares', 'The company soars. So do you.', 'A decent result. Roughly what the raise would have been worth.', 'The shares vest under water.'],
  ]),
  career_remote_work: c('Remote work approved', 'You can work from home for good, if you want to.', [
    'Keep going to the office',
    'Go remote',
    ['Ask for a raise instead', 'They would rather pay you than lose the desk.', 'No.'],
  ]),
  career_boss_leaves: c('Your boss is leaving', 'Your boss is off to a rival and wants you on the team. More pay, they promise.', [
    'Stay',
    ['Go with them', 'The new company takes off, and you with it.', 'Six months in, they are fired. Your sponsor is gone.'],
    ['Use the offer to negotiate', 'Your company will not lose you, and pays you more.', 'They say the door is open. On the way out.'],
  ]),
  career_become_manager: c('Lead the team', 'Your manager is leaving and has put your name forward.', [
    'Stay hands-on',
    'Take the team',
  ]),
  career_law_firm: c('The firm takes clerks', 'A law firm is hiring paralegals. The hours are long and the ladder is the tallest in town.', [
    'Stay where you are',
    'Start at the bottom in law',
    ['Pay for the entrance course', 'You pass. The firm calls on Monday.', 'You fail the exam by four points.'],
  ]),
  career_market: c('Saturday at the market', 'A stallholder needs someone to sell. Nobody asks for a CV.', [
    'Walk on',
    'Sell at the stall',
  ]),
  career_bar: c('Staff wanted', 'The bar on the corner cannot keep up, and the tips jar is full.', [
    'Walk past',
    'Put on the apron',
  ]),
  career_teaching: c('A teacher is needed', 'The school down the road has lost a teacher in the middle of the year. Your degree will do.', [
    'It is not for you',
    'Take the class',
  ]),
  career_creator: c('The video that travelled', 'You filmed it in your bedroom and a hundred thousand people have watched it. Brands are writing to you.', [
    'Keep your job',
    'Make this your job',
  ]),
  career_out_of_town: c('An offer forty minutes away', 'A firm on the industrial estate pays better. There is no train: you would drive.', [
    'Stay where you are',
    'Take it',
    ['Ask for more', 'They agree.', 'They hire someone else.'],
  ]),
  career_headhunter: c('A headhunter calls', '"Are you free for a confidential coffee?"', [
    'Not interested',
    ['Take the meeting', 'A better package at a better firm.', 'A pleasant coffee and nothing more.'],
    'Take the role in {city:new_york}',
  ]),

  // Education
  edu_masters: c("A master's degree", 'Two years of evenings and weekends, and a title on your CV.', [
    'Not now',
    'Pay for it',
    'Take a loan for it',
  ]),
  edu_finance_course: c('A course on investing', 'Twelve weeks, one evening each: bonds, stocks and how not to lose it all.', [
    'Skip it',
    'Sign up',
  ]),
  edu_finance_book: c('A book on money', 'A colleague lends you the book that "changed how she thinks about money".', [
    'Leave it on the shelf',
    ['Read it', 'It clicks. You understand what a bond is.', 'You fall asleep on page forty.'],
  ]),
  edu_mba: c('The MBA', 'You have a place on the {item:edu_mba}. It costs a fortune and eats two years of evenings.', [
    'Not for me',
    'Enrol and pay',
    'Enrol with a loan',
  ]),
  edu_bootcamp: c('Coding bootcamp', 'Sixteen weeks to become a junior developer. They say everyone gets hired.', [
    'Skip it',
    'Join and switch to tech',
  ]),
  edu_language: c('A new language', 'A teacher two streets away gives evening classes.', [
    'Maybe next year',
    'Sign up',
  ]),

  // Business
  biz_freelance_gig: c('A freelance gig', 'An old client needs a job done over three weekends.', [
    'Pass',
    'Take it',
    'Take it, and the one at their other site by car',
  ]),
  biz_self_employed: c('Go it alone', 'You could do your job for three clients instead of one boss.', [
    'Keep the payslip',
    ['Go self-employed', 'Clients queue up. You raise your rates.', 'It works out about the same, with more paperwork.', 'Two clients pay late and one not at all.'],
    ['Start with people from where you are a member', 'They recommend you to each other. You raise your rates.', 'It works out about the same, with more paperwork.', 'Many pats on the back and few orders.'],
  ]),
  biz_bar: c('A bar of your own', 'The bar on the corner is for sale. The owner wants out by spring.', [
    'Walk past',
    ['Buy it and run it', 'Full every weekend. It pays you well.', 'It ticks over. A little money, a lot of nights.', 'It closes within the year.'],
    ['Back a friend who will run it', 'Your share pays a modest cheque every year.', 'It never opens.'],
  ]),
  biz_online_shop: c('An online shop', 'You have found a product people keep asking where to buy.', [
    'Leave it',
    ['Launch it', 'Orders pour in.', 'A side income, most months.', 'A garage full of unsold stock.'],
  ]),
  biz_airbnb: c('The spare room', 'Your spare room could earn its keep on {brand:airbnb}.', [
    'Keep your privacy',
    'List it',
  ]),
  biz_app: c('Launch an app', 'You have had the idea for a year. It would take every night for six months.', [
    'Keep it in the drawer',
    ['Build it', 'It takes off. Subscriptions roll in.', 'A small, loyal user base pays the hosting and a bit more.', 'Nobody downloads it. You learned a lot.'],
  ]),
  biz_cofounder: c('The co-founder pitch', 'A sharp ex-colleague is starting a company and wants you in.', [
    'Wish them luck',
    ['Put money in', 'They get acquired. Your stake pays nine times over.', 'A modest exit. You get your money back and a little more.', 'The company folds.'],
    ['Join as a co-founder', 'Acquired. Life-changing money.', 'A small exit, and a very good story.', 'It folds. You come out wiser.'],
  ]),
  biz_acquisition: c('An offer for the business', 'A larger company wants to buy you out. The number is real.', [
    'Keep the business',
    'Sell',
    ['Ask for more', 'They pay it.', 'They walk away.'],
  ]),

  // Investing
  inv_hot_tip: c("Your cousin's hot tip", '"Trust me. {asset:tesla}. It cannot go down."', [
    'Change the subject',
    'Put a little in',
    'Go big',
  ]),
  inv_share_plan: c('The employee share plan', 'Your employer sells you {asset:microsoft} shares at a 15% discount.', [
    'Skip it',
    'Buy some',
    'Buy the maximum',
  ]),
  inv_memecoin: c('The coin with the dog', 'Everyone at the gym owns {asset:dogecoin}. One of them just bought a car with it.', [
    'Stay out',
    'A small bet',
    'All in',
  ]),
  inv_friend_startup: c("A friend's startup", 'A friend is raising money from "people who believe in us".', [
    'Not this time',
    ['Invest', 'They sell the company. You are suddenly a genius.', 'A small return, years later.', 'It runs out of money.'],
    'Give advice, not money',
  ]),
  inv_ipo_hype: c('The hot IPO', 'The listing everyone is talking about opens tomorrow and your broker has an allocation.', [
    'Watch from the side',
    ['Subscribe', 'It pops on day one.', 'It drifts a little below the price.', 'It halves within the month.'],
  ]),
  inv_ponzi: c('"20% a month, guaranteed"', 'A well-dressed friend of a friend has a fund that never loses. He shows you his statements.', [
    'Walk away',
    ['Try a little', 'You get paid, for now. You take it and run.', 'The website is gone on Monday.'],
    ['Go all in', 'You get out a week before it collapses.', 'It was a pyramid. It always is.'],
  ]),
  inv_exchange_freeze: c('Withdrawals suspended', 'The exchange that holds your coins has "paused withdrawals for maintenance".', [
    ['Wait it out', 'It reopens. Everything is there.', 'It never reopens. Part of your coins is gone.'],
    'Pay the exit fee and get out',
  ]),
  inv_offplan_dubai: c('Off-plan in {city:dubai}', 'A glossy brochure, a tower that does not exist yet, and a payment plan.', [
    'Bin the brochure',
    ['Reserve a unit', 'You sell the contract at a profit before it is built.', 'You get your deposit back, eventually.', 'The developer goes quiet. You recover a fraction.'],
  ]),
  inv_guru_course: c('The trading guru', 'He posts from a rented supercar and his course is "almost sold out".', [
    'Scroll on',
    ['Buy the course', 'Under the noise there is a decent lesson on risk.', 'Six hours of motivational quotes.'],
  ]),
  inv_crowdfunding: c('Property crowdfunding', 'A platform lets you own a slice of a rental building.', [
    'Pass',
    ['Buy a slice', 'The rent arrives every quarter.', 'The platform folds and the payments stop.'],
  ]),

  // Housing
  house_rent_hike: c('The rent goes up', 'A letter from your landlord: "in line with the market".', [
    'Pay up',
    ['Negotiate', 'He would rather keep a good tenant.', 'He does not move an inch.'],
  ]),
  house_first_flat: c('Your first flat', 'A first-time buyer scheme lets you in with a tenth of the price.', [
    'Keep renting',
    'Buy a studio',
    'Buy a flat, with help from home',
  ]),
  house_landlord_sells: c('The landlord is selling', 'He offers you first refusal, a little under the asking price.', [
    'Move out',
    'Buy it',
  ]),
  house_refinance: c('Fixed or variable', 'Your bank offers to switch the rate of your mortgage, this time with no fee.', [
    'Leave it',
    'Switch your variable mortgages to fixed',
    'Switch your fixed mortgages to variable',
  ]),
  house_tenant_default: c('The tenant stops paying', 'Three months of silence and a full letterbox.', [
    'Wait and absorb the loss',
    ['Hire a lawyer', 'The tenant pays up and leaves.', 'A year in court, and a flat to repaint.'],
  ]),
  house_renovation: c('Renovate', 'The kitchen is from another century and the bathroom leaks.', [
    'Patch it up',
    'Do it properly',
    'Go premium',
  ]),
  house_flood: c('Water damage', 'A pipe bursts while you are away for the weekend. It is your flat, so it is your bill.', [
    'Call the repair firm',
    'Do most of it yourself',
  ]),
  house_move_in: c('Move in together', 'Two rents, two fridges, and you are always at theirs anyway.', [
    'Not yet',
    'Move in together',
  ]),

  // Lifestyle
  life_sports_car: c("A colleague's new car", 'He parks it across two spaces. Everyone goes down to look.', [
    'Shrug',
    'Buy his old {item:car_vw_golf_gti}, cheap',
    'Finance a {item:car_bmw_m3}',
  ]),
  life_retreat: c('A retreat in Tulum', 'A friend is back from a week of yoga and silence and will not stop talking about it.', [
    'Keep working',
    'A simple week',
    ['The luxury retreat, with a shaman', 'You come back new. You even sleep better.', 'Lovely, very dear, and the mosquitoes ate you.'],
  ]),
  house_trendy_area: c('The neighbourhood of the moment', 'A flat comes free in the neighbourhood everyone talks about. Speciality coffee, galleries and a rent to match.', [
    'Stay where you are',
    'Take the whole flat',
    'Share a flat there',
  ]),
  life_ibiza: c('Ibiza', 'The group chat has a villa, dates and a deposit deadline.', [
    'Stay home',
    'Go',
    'Go, with a table at the club',
  ]),
  life_new_phone: c('The new {item:tech_phone}', 'Yours still works. This one has a better camera.', [
    'Keep the old one',
    'Buy it',
  ]),
  life_wedding_abroad: c('A wedding abroad', 'Your friend is getting married on a lake, four days, dress code "elegant".', [
    'Send a gift',
    'Go',
    'Go in style',
  ]),
  life_rolex_call: c('The waiting list', 'The boutique calls. After two years, your {item:watch_rolex} is in.', [
    'Let it go',
    'Buy it and wear it',
    'Buy it and flip it',
  ]),
  life_upgrade: c('An upgrade at the gate', 'For a fraction of the fare, the seat turns into a bed.', [
    'Stay in economy',
    'Take the upgrade',
  ]),
  life_designer_sale: c('Private sale', 'Forty per cent off, tonight only, by invitation.', [
    'Delete the email',
    'The {item:fashion_loafers}',
    'The {item:fashion_duffel}',
  ]),
  life_car_finance: c('You need a car', 'The metro stops at midnight and the new job does not.', [
    'Keep taking the metro',
    'Buy a {item:car_toyota_corolla} outright',
    'Finance a {item:car_tesla_model_3}',
  ]),
  life_club_contacts: c('At the bar of the club', 'A member you nod to every week is putting money into a friend\'s restaurant and is looking for one more partner.', [
    'Change the subject',
    ['Put money into the restaurant', 'It works. Your share arrives every year.', 'It closes within the year. You never see that money again.'],
    'Ask them to introduce you around',
    ['Ask to meet the one who decides at your company', 'One dinner later, they offer you the job above yours.', 'They listen with interest. They will call.'],
  ]),
  life_bottle_service: c('Bottle service', 'Someone suggests a table. The waiter is already holding the menu.', [
    'Go home early',
    ['Chip in', 'You meet people worth knowing.', 'A headache and a receipt.'],
    'Put the table on your card',
  ]),
  life_black_friday: c('Black Friday', 'Your basket has been full since Tuesday.', [
    'Close the tab',
    'The {item:tech_console}',
    'The {item:tech_laptop}',
  ]),

  // Family
  fam_dating: c('Start dating', 'A friend wants to set you up. You have run out of excuses.', [
    'Stay single',
    'Say yes',
  ]),
  fam_wedding: c('The wedding', 'You are getting married. The only question is how.', [
    'Town hall and lunch',
    'A classic wedding',
    'The big one',
  ]),
  fam_first_child: c('A child?', 'The two of you have started walking past prams more slowly.', [
    'Not yet',
    'Yes',
  ]),
  fam_prenup: c('A prenup', 'Your notary mentions it, carefully.', [
    'No need',
    'Sign one',
  ]),
  fam_sibling_loan: c('Your sibling needs money', '"Just until the summer."', [
    'Say no',
    ['Lend it', 'Paid back in full, with a bottle of wine.', 'Never paid back, and never forgotten: you were there.'],
    'Give a smaller sum as a gift',
  ]),
  fam_cosign: c('Co-sign a loan', 'Your oldest friend needs a guarantor for a loan.', [
    'Refuse',
    ['Sign', 'They pay every month. The friendship is stronger for it.', 'They stop paying. The bank comes to you.'],
  ]),
  fam_support_parents: c('Your parents need help', 'The pension does not stretch as far as it used to.', [
    'You cannot right now',
    'Send money every month',
    'Pay for a carer',
  ]),
  fam_inheritance: c('An inheritance', 'Your grandmother left you something, and a note that says "be sensible".', [
    'Take the cash',
    'Put it all in an index fund',
    'Make it the deposit on a flat to let',
  ]),
  fam_divorce: c('Divorce', 'It has been a long time coming.', [
    'Settle quietly',
    'Hire a good lawyer',
    ['Try counselling', 'It helps. You stay together.', 'It only made the ending clearer.'],
  ]),
  fam_school: c('Which school', 'The local school is fine. The other one has a waiting list and a blazer.', [
    'The local school',
    'A private school',
    'The international school',
  ]),

  // Health
  health_illness: c('A serious illness', 'Tests, a diagnosis, and a treatment plan with a price.', [
    'Go private, now',
    'Use the public system and wait',
    'Claim on your life cover',
  ]),
  health_burnout: c('Burnout', 'You have been staring at the same email for an hour.', [
    'Push through',
    'Take unpaid leave',
    'See a therapist',
  ]),
  health_dental: c('A dental emergency', 'A tooth cracks on an olive stone.', [
    'Get it fixed properly',
    ['Find a cheap clinic', 'A neat job at a third of the price.', 'It has to be redone. Properly, this time.'],
  ]),
  health_injury: c('A sports injury', 'A five-a-side game, a wet pitch, a knee.', [
    'Private physio',
    'Wait for the public list',
    ['Play through the pain', 'It holds: nobody notices a thing.', 'It gives out, and this time for months.'],
    'Train your way back',
  ]),
  health_gym_habit: c('Join the gym', 'There is a gym downstairs and you get out of breath on the stairs.', [
    'Maybe next year',
    'Join, and actually go',
  ]),

  // Luck
  luck_lottery: c('The office Christmas lottery', 'Everyone at work is chipping in for tickets. You are not going to be the one who misses out.', [
    'No ticket for you',
    ['Buy a ticket', ...lotteryResults],
    ['Buy ten', ...lotteryResults],
  ]),
  luck_car_breakdown: c('The car will not start', 'A click, a warning light, and a tow truck.', [
    'The official garage',
    ['A cheap garage', 'Fixed in an afternoon.', 'It breaks again, and now it is worse.'],
  ]),
  luck_tax_refund: c('A tax refund', 'The tax office owes you money. It happens.', [
    'Take the cash',
    'Put it in the pension',
  ]),
  luck_stolen_phone: c('Your phone is stolen', 'One second it was on the café table.', [
    'Buy a replacement',
    'Dig out an old one',
  ]),
  luck_bonus: c('A surprise bonus', 'A good year. Your manager calls you in, smiling.', [
    'Take the bonus',
    ['Ask for a raise instead', 'You get the raise.', 'You get a smaller bonus and a lecture.'],
  ]),
  luck_phishing: c('A message from "your bank"', 'It looks right. It says your account is blocked.', [
    ['Deal with it quickly', 'It was real, and harmless.', 'It was not your bank.'],
    'Check it properly',
  ]),
  luck_speeding_fine: c('A speeding fine', 'A photo of your car arrives in the post.', [
    'Pay it',
    ['Contest it', 'The fine is cancelled.', 'Rejected, with a surcharge.'],
  ]),
  luck_betting_app: c('The betting app', 'A free bet to get you started. Your team plays tonight.', [
    'Delete the app',
    ['A small bet', 'A late goal. You win.', 'You lose.'],
    ['Chase a big win', 'It comes in.', 'It does not.'],
  ]),

  // World
  world_recession: c('Recession', 'Factories slow down, shops close, and every headline has the same word in it.', [
    'Sit tight',
    'Cut back and save',
    'Buy the dip',
  ]),
  world_rate_hike: c('Rates jump', 'The central bank raises rates. Mortgages and savings both wake up.', [
    'Take note',
    'Fix your mortgage',
    'Buy short-term bonds',
  ]),
  world_rate_cut: c('Rates fall', 'The central bank cuts. Borrowing is cheap again.', [
    'Take note',
    'Switch to a variable mortgage',
    'Borrow and invest',
  ]),
  world_inflation: c('Prices run away', 'Your weekly shop costs what a dinner out used to.', [
    'Tighten your belt',
    ['Ask for a cost-of-living raise', 'You get it.', 'No budget.'],
    'Buy gold',
  ]),
  world_crypto_bull: c('Crypto fever', 'Coins are on the front page and your taxi driver has an opinion.', [
    'Stay out',
    'Buy some {asset:bitcoin}',
    'Take a course first',
  ]),
  world_crypto_winter: c('Crypto winter', 'The charts are red and the forums are quiet.', [
    'Look away',
    'Buy the fear',
  ]),
  world_housing_crash: c('The housing market cracks', 'For-sale signs everywhere in your city, and prices falling.', [
    'Wait',
    'Buy a distressed studio to live in',
    'Buy one to rent out',
  ]),
  world_tech_bubble: c('Tech mania', 'Every company is suddenly a technology company.', [
    'Stay diversified',
    'Ride it with {asset:nvidia}',
  ]),
  world_ai_boom: c('The AI boom', 'New tools every week. Half your job could be done differently.', [
    'Carry on as before',
    'Learn the tools',
    ['Ask to lead the AI work', 'The role is yours, with a raise.', 'They hire someone from outside.'],
  ]),
  world_pandemic: c('Pandemic', 'Borders close and the streets empty. Everyone learns to bake.', [
    'Stay in',
    'Volunteer',
    'Day-trade from the sofa',
  ]),
  world_tax_reform: c('Tax reform', 'A new budget rewrites the rates somewhere. Check the Taxes tab: it may be your city.', [
    'Read the summary',
    'See a tax advisor',
  ]),
  crisis_crash_panic: c('Black Monday', 'Screens are red from Tokyo to New York. Your phone will not stop buzzing with people asking what you are going to do.', [
    'Look away and hold',
    'Buy while everyone sells',
    'Draw on your credit line while the bank still lends',
  ]),
  crisis_crash_layoffs: c('The second wave', 'A year in, the crash has reached the payroll. Your employer calls an all-hands meeting for Friday.', [
    ['Keep your head down', 'Your job and your pay survive.', 'You keep the job, on less pay.'],
    'Offer to take a pay cut',
    'Use the quiet months to retrain',
  ]),
  crisis_energy_bills: c('The bill', 'Heating, petrol and the weekly shop have all jumped at once. The envelope on the mat is thicker than usual.', [
    'Pay it',
    'Tighten your belt',
  ]),
  crisis_energy_wages: c('Wages against prices', 'Prices have run two years ahead of pay. There is talk of a strike, and of who will blink first.', [
    'Wait it out',
    ['Walk out with the others', 'The raise is won.', 'The strike fails and the days are docked.'],
    'Cut back at home instead',
    ['Ask on your own for a cost-of-living raise', 'You get it, quietly.', 'They tell you to wait and see how the strike ends.'],
  ]),
  crisis_debt_spreads: c('The spread', 'Lenders want twice as much to hold your government\'s debt. Every loan priced off it is about to follow.', [
    'Wait and see',
    'Lock your mortgage rate now',
    'Flee to {asset:bund}',
  ]),
  crisis_debt_austerity: c('Cuts', 'The budget is balanced the hard way: a one-off levy, frozen pay, and bargains for anyone with cash.', [
    'Pay the levy',
    'Pay it, and take on the work of two',
    'Pay it, and buy a repossessed studio to let',
  ]),
  world_bank_failure: c('A bank fails', 'A mid-sized bank closes its doors and queues form outside the others.', [
    ['Trust the guarantee', 'Your savings are safe.', 'Part of your savings was over the limit.'],
    'Queue and move your money',
  ]),

  // Tax
  tax_advisor: c('Hire a tax advisor?', 'Doing it yourself costs software, a weekend and the odd mistake. An advisor costs more, but finds deductions and covers you if inspected.', [
    ['Keep doing it yourself', 'You file on time, with three tabs open and a coffee.', 'A wrong box: the tax office charges a surcharge.'],
    ['Hire the advisor', 'They find deductions you never knew existed: the fee pays for itself and then some.', 'Nothing to deduct this year, but now someone will stand up for you to the tax office.'],
  ]),
  tax_pension_topup: c('Pension top-up', 'Your employer will match what you add to your pension this year.', [
    'Skip it',
    'Add a little',
    'Add the maximum',
  ]),
  tax_optimise: c('Your tax return', 'A shoebox of receipts and a deadline.', [
    'File it as usual',
    'Go through every receipt',
  ]),
  tax_letter: c('A letter from the tax office', 'The tax office says your return had a mistake, and says what you owe.', [
    'Pay and forget it',
    ['Appeal', 'You were right: the file is closed.', 'You lose, and pay with interest.'],
    ['Pay an accountant to look at it', 'One phone call sorts it.', 'Not even they can: you pay.'],
  ]),
  tax_audit: c('A tax audit', 'A registered letter. They want three years of paperwork.', [
    'Pay what they ask',
    ['Contest it', 'They drop it.', 'They find more.'],
  ]),
  tax_undeclared: c('Cash in hand', 'A client offers to pay more if there is no invoice.', [
    'Invoice it properly',
    ['Take the envelope', 'Nobody ever asks.', 'Somebody asks. The fine is larger than the job.'],
  ]),
  tax_residency: c('Change tax residency', 'An advisor shows you what you would keep if you lived in {city:dubai}.', [
    'Stay',
    'Move to {city:dubai}',
    'Pay for proper advice first',
  ]),

  // Later life
  late_porsche: c('A {item:car_porsche_911}', 'You walk past the showroom every day. Today you walk in.', [
    'Walk out again',
    'Buy it',
    'Finance it',
  ]),
  late_university: c('University', 'Your child has an offer from a good university abroad.', [
    'The public university at home',
    'The good one abroad',
    'They take a student loan',
  ]),
  late_early_retirement: c('Early retirement', 'The company offers a package to anyone who leaves this year.', [
    'Keep working',
    'Take the package',
  ]),
  late_downsizing: c('Downsizing', 'The house is too big now. A small rented flat by the sea would do.', [
    'Stay',
    'Sell and rent by the sea',
  ]),
  late_will: c('Write your will', 'Nobody likes the appointment. Everybody is glad afterwards.', [
    'Later',
    'Write it',
  ]),
  career_restructuring: c('Restructuring', 'The company is reviewing who costs the most. Your name is on the list.', [
    'Accept a lower post',
    'Take the way out with a payoff',
    ['Fight for your post', 'You stay. This time.', 'You lose the fight and leave with a smaller payoff.'],
  ]),
  late_gift: c('Giving in life', 'Your children are at the age when a push helps most. Whatever you give pays the gift tax now.', [
    'Let them wait for the inheritance',
    'Help with a deposit on a flat',
    'Share out half now',
  ]),
  late_business_handover: c('The future of the business', 'Years at the helm. A buyer is asking about it, and someone at home would like to carry on.', [
    'Stay in charge',
    'Sell to the buyer',
    'Hand it to your children',
  ]),
  late_parents_care: c('Your parents cannot manage alone', 'Your mother fell last month. Someone has to keep an eye on them, and a phone call is not enough.', [
    'Leave it to your siblings',
    'Pay for a care home',
    'Look after them yourself',
  ]),
  career_four_day_week: c('A four-day week', 'The company is trying a four-day week: a fifth less pay for an extra day off, for good.', [
    'Stay full-time',
    'Go to four days',
  ]),
  edu_company_course: c('A course the company pays for', 'They will pay for an expensive course. The small print: stay two years, or pay it back.', [
    'No, thanks',
    'Accept, with two years\' commitment',
    'Pay for it yourself, no strings',
  ]),
  biz_rival: c('A rival opens next door', 'A place just like yours has opened on the same street, with a grand opening.', [
    ['Wait and see', 'It takes your customers: your business loses value.', 'Its customers come back to you in a month.'],
    'Cut your prices',
    'Refit the place',
  ]),
  biz_viral_review: c('A review goes viral', 'Someone wrote about your business and half the neighbourhood shared it. You do not know the tone yet.', [
    ['Let it run', 'It was good: there is a queue at the door.', 'It was bad, and the till shows it.'],
    ['Reply with care', 'Your reply is liked more than the review.', 'Nobody reads replies.'],
    'Buy fake reviews',
  ]),
  biz_labour_inspection: c('A labour inspection', 'An inspector asks for the contracts, the hours and the payslips of your business.', [
    ['Let them come', 'All in order. They leave after a coffee.', 'One contract was wrong: a fine.'],
    'Call in an employment adviser first',
  ]),
  inv_bank_product: c('A "guaranteed" product', 'Your bank offers a two-year bond "with no risk". Entry fee included, in the small print.', [
    'No, thanks',
    'Take it',
    'Ask for an index fund with no fee',
  ]),
  inv_leveraged_etf: c('A fund that triples', 'An influencer swears by a leveraged ETF: three times what the market does. Up and down.', [
    'Pass',
    ['Put money in', 'The market rose: you triple it.', 'The market stood still: you get back what you put in.', 'The market fell: it evaporates.'],
  ]),
  house_noisy_neighbours: c('Noisy neighbours', 'Upstairs practise the drums at dinner time. And at bedtime.', [
    'Put up with it',
    ['Go up and talk to them', 'They apologise and turn it down.', 'They look at you oddly and turn it up.'],
    'Find another flat to rent',
    'Soundproof your home',
  ]),
  house_levy: c('A building levy', 'The lift has to be replaced and the residents voted a levy. Your share, due this month.', [
    'Pay your share',
    ['Appeal it', 'The judge agrees with you.', 'You lose, and pay with interest.'],
  ]),
  house_lodger: c('Let a room', 'You have a spare room and a friend is looking for somewhere to live. She would pay well.', [
    'Better not',
    'Let it to her',
  ]),
  life_bali_wedding: c('A wedding in Bali', 'Your best friend is getting married in Bali. Flights, hotel, a gift and a week off work.', [
    'Send your apologies',
    'Go to Bali',
  ]),
  fam_dog: c('A dog at the shelter', 'A three-year-old dog looks at you from its pen as if it already knows you.', [
    'Better not',
    'Adopt it',
  ]),
  fam_partner_startup: c('Your partner wants to start up', 'Your partner wants to quit to start something of their own. They need your support, and a while with no pay.', [
    'Ask them not to',
    ['Back them', 'It works: they earn more than ever.', 'It fails: back to work, for less.'],
  ]),
  tax_no_vat: c('Without VAT?', 'A client offers to pay you in cash, with no invoice. Cheaper for both of you.', [
    'Invoice it, with VAT',
    'No VAT, cash in hand',
  ]),
  tax_amnesty: c('A tax amnesty', 'The government announces an amnesty: whoever comes clean now pays 10% of what they hid, and is clear.', [
    'Take your chances',
    'Come clean',
  ]),
  late_motorbike: c('A motorbike, at your age', 'A Ducati in the window, and the feeling that life is passing by.', [
    'No way',
    'Buy it',
    'Buy it on instalments',
  ]),
  late_mentor: c('Be a mentor', 'A charity is looking for retired people to guide young people starting out. A few hours a week.', [
    'Your garden comes first',
    'Be a mentor',
  ]),
  late_scam_call: c('An urgent message', '"Mum, Dad, my phone broke. This is my new number. I need $3,000 today."', [
    ['Ignore it', 'It was a scam. Well done.', 'It was real, and they do not forgive you.'],
    ['Send the money', 'It was a scam. The money is gone.', 'It was real. They are grateful.'],
    'Call the number you know',
    'Spot the scam at once',
  ]),
  city_madrid_cana: c('One drink, they said', 'A colleague says one caña after work. In Madrid, one caña is dinner at midnight.', [
    'Go home',
    'Stay for dinner',
  ]),
  city_madrid_tourist_flat: c('August in the city', 'Everyone leaves Madrid in August. Your flat could earn its keep while you are away.', [
    'Leave it empty',
    'Let it properly, with the paperwork',
    'Let it for cash, no questions',
  ]),
  city_london_tube_strike: c('The Tube is on strike', 'No trains for a week, and the office still opens at nine.', [
    'Take cabs all week',
    'Work from home and fall behind',
  ]),
  city_london_club: c('A club would have you', 'A member of a private club in Mayfair offers to put your name forward.', [
    'Politely decline',
    'Pay the joining fee',
  ]),
  city_new_york_rent_hike: c('The rent goes up a fifth', 'Your landlord writes to say the lease will renew at twenty per cent more.', [
    'Pay it',
    ['Fight it at the rent board', 'The board caps the rise. You stay at the old rent.', 'The board sides with the landlord, and you pay the fees too.'],
  ]),
  city_new_york_elevator_pitch: c('Forty floors with an investor', 'A famous investor steps into your lift. You have about forty seconds.', [
    'Look at your phone',
    ['Make your pitch', 'He gives you his card. A month later you have a better job.', 'He nods politely and gets out on the thirtieth floor.'],
  ]),
  city_dubai_visa: c('The visa is up', 'Your residence visa needs renewing, with a medical, a form and a fee.', [
    'Pay an agent to do it',
    'Spend a day in the queues',
  ]),
  city_dubai_golden_visa: c('A golden visa', 'With what you hold, you could have ten years of residence and the status that comes with it.', [
    'Not needed',
    'Apply for it',
  ]),
  city_singapore_ballot: c('A ballot for a new flat', 'The state is building flats at a fraction of the market price. There is a ballot.', [
    'Do not enter',
    ['Enter the ballot', 'Your number comes up: a new flat at a fraction of the price.', 'Your number does not come up this time.'],
  ]),
  city_singapore_gum: c('Caught chewing', 'A warden spots you with gum on the MRT. It is a fine city, in every sense.', [
    'Pay the fine',
    'Plead and do a morning of litter-picking',
  ]),
  city_bangkok_flood: c('The rains come in', 'The monsoon floods your street and the ground floor with it.', [
    'Let the insurer handle it',
    'Sandbag and clean up yourself',
  ]),
  city_bangkok_beach_bar: c('A bar on the beach', 'A friend in Koh Samui needs one more partner for a bar on the sand.', [
    'Stay in the city',
    ['Put money in', 'A good season: the bar pays you back twice over.', 'The season is wet and empty. The money stays in the sand.'],
  ]),
  city_tokyo_earthquake: c('The ground moves', 'A strong earthquake shakes the city. Your home is standing, but not unhurt.', [
    'Call the insurer',
    'Repair what you can yourself',
  ]),
  city_tokyo_karaoke: c('Karaoke with the boss', 'After the year-end party, your manager books a karaoke room and looks at you.', [
    'Make your excuses',
    ['Take the microphone', 'Your ballad brings the room to tears. On Monday the boss remembers you.', 'Nobody remembers the song. Everybody remembers the hangover.'],
  ]),
  city_moscow_rouble: c('The rouble falls', 'The rouble drops a third against the dollar overnight, and your salary with it.', [
    'Ride it out',
    'Negotiate your pay in dollars',
  ]),
  city_moscow_dacha: c('A dacha in the family', 'An aunt leaves you her wooden dacha an hour out of the city.', [
    'Sell it',
    'Keep it for the weekends',
  ]),
  city_mexico_city_mordida: c('The inspector waits', 'An inspector finds a problem with your paperwork, and lets you know it could go away.', [
    ['Refuse and take your chances', 'The fine arrives, with every stamp on it.', 'The inspector shrugs and finds someone else to visit.'],
    'Pay the mordida',
  ]),
  city_mexico_city_taqueria: c('A partner for the taquería', 'The taquero on your corner wants a partner to open a second stand.', [
    'Wish him luck',
    'Put money in',
  ]),
  city_zurich_numbered_account: c('An account with a number', 'A discreet banker suggests an account known only by its number.', [
    'Thank him and leave',
    ['Open the account', 'The account grows quietly, and nobody asks.', 'A leak, a list, and the tax office reads your name on it.'],
  ]),
  city_zurich_referendum: c('A vote on the taxes', 'The canton votes on cutting its income tax. You could campaign for it.', [
    'Just vote',
    ['Campaign for the cut', 'The cut passes, and your next bill shrinks.', 'The canton votes no. You keep the leaflets.'],
  ]),
  crime_trial: c('Your day in court', 'The charges stand. A courtroom, a judge who has heard every excuse, and you.', [
    ['Take the state\'s lawyer', 'He finds a loophole nobody expected. You walk out free.', 'He finds your file ten minutes before the hearing. Two rounds inside.'],
    ['Hire the best lawyer in town', 'Expensive, brilliant and smug. Acquitted.', 'Even the best lose sometimes. One round inside.'],
    'Make a deal and name your partner',
  ]),
  crime_wrongly_accused: c('Not guilty, honestly', 'The police are sure you did something you did not do. You were at the dentist.', [
    ['Trust the state\'s lawyer', 'The dentist testifies. You are cleared, and your teeth are fine.', 'The dentist is on holiday. A round inside for nothing.'],
    'Pay a good lawyer',
  ]),
  crime_jail_cellmate: c('Your cellmate, the banker', 'The man in the bunk above ran a hedge fund. He has opinions about your portfolio.', [
    'Pretend to sleep',
    'Take notes',
  ]),
  crime_jail_commissary: c('The noodle economy', 'Inside, instant noodles are money. Everybody wants them, nobody has enough.', [
    'Buy what you need',
    ['Run the noodle trade', 'You become the central bank of the whole wing.', 'Caught with two hundred packets. Your sentence grows.'],
  ]),
  crime_jail_library: c('The prison library', 'Three shelves, a dictionary and a lot of time.', [
    'Sleep through it',
    'Learn a language',
    'Study for your trade',
  ]),
  crime_memoirs: c('Memoirs from a cell', 'A publisher thinks your story would sell. A podcast thinks so too.', [
    'Keep it to yourself',
    ['Tell everything', 'A bestseller, a tour and a film option.', 'Twelve copies sold, nine of them to your mother.'],
  ]),
  crime_fake_mba: c('A small upgrade', 'Nobody checks a CV. An MBA would look very good on yours.', [
    'Leave the CV as it is',
    'Add the MBA',
  ]),
  crime_fake_mba_found: c('HR has a question', 'Human Resources would like a copy of your MBA certificate. By Friday.', [
    ['Bluff your way through', 'They forget to ask again. You breathe.', 'They call the business school. Your desk is cleared by noon.'],
    'Come clean',
  ]),
  crime_ham_smuggling: c('A suitcase full of ham', 'A friend will pay well for whole Iberian hams, brought in your luggage. Customs may disagree.', [
    'Pack only clothes',
    ['Pack the hams', 'The scanner shows shoes. Your friend pays in cash.', 'A sniffer dog, a fine and a very confused officer.'],
  ]),
  crime_memecoin: c('Launch your own coin', 'Call it $RATA, pay some influencers, sell before anyone notices. What could go wrong?', [
    'Keep your dignity',
    ['Launch $RATA', 'It goes up a hundredfold. You sell at the top.', 'It goes up, you sell, and the regulator reads your messages.', 'Nobody buys. The logo was nice.'],
  ]),
  crime_illegal_betting: c('A sure thing', 'A man in a bar swears the second division match on Sunday is decided already.', [
    'Watch it for free',
    ['Bet two thousand', 'He was right. You collect, quietly.', 'He was wrong. So much for sure things.', 'The match was rigged, and the police were watching the bets.'],
  ]),
  crime_enchufe: c('A cousin in the ministry', 'Your cousin can find you a public post, no exam needed. Family helps family.', [
    'Say no, thanks',
    ['Accept the favour', 'A desk for life, and a cousin you now owe forever.', 'An anonymous complaint, and an inspector reading the hiring file.'],
  ]),
  crime_insider_tip: c('Your brother-in-law knows something', 'He works at a bank. A takeover is coming on Monday, and nobody knows yet.', [
    'Change the subject',
    ['Buy before Monday', 'Monday comes, the shares jump. You sell.', 'The shares jump, you sell in a hurry… and the regulator charges you with insider trading.', 'There was no takeover: it was another bank. You sell at a loss.'],
  ]),
  crime_laundering: c('Clean money', 'Your business takes plenty of cash. A friend explains how it could take a little more, on paper.', [
    'Keep the books honest',
    'Wash what you have hidden',
  ]),
  lodger_good: c('The perfect lodger', 'Pays on the first of the month, waters the plants and never uses your mug.', [
    'Leave things as they are',
    ['Put the rent up a little', 'They pay it without a word.', 'They find somewhere else. You should have left it.'],
  ]),
  lodger_unpaid: c('The rent is late', 'Your lodger has not paid this month, nor last. There is music behind the door.', [
    ['Give them another month', 'They pay it all, with an apology and a cake.', 'They leave in the night, owing you three months.'],
    'Ask them to leave',
  ]),
  lodger_friend: c('A lodger who knows people', 'Your lodger wants you to meet a friend who works where you would like to.', [
    'A dinner, nothing more',
    'Take the card, and follow up',
  ]),
  lodger_tension: c('Tension at home', 'Your partner cannot stand finding the lodger on the sofa every evening.', [
    'They are right: the lodger goes',
    ['It is only a little longer', 'You hold out, with a frosty atmosphere.', 'Your partner moves out before the lodger does.'],
  ]),
  red_licence: c('No licence yet', 'Your business has to close for a few weeks: a paper is missing, and nobody knows who signs it.', [
    'Wait for it',
    'Pay a fixer to move it along',
    ['Open anyway', 'Nobody comes to look.', 'An inspector comes: a fine, and your name on file.'],
  ]),
  red_appointment: c('The appointment', 'Renewing a paper needs an appointment. The first one free is three weeks away, a Tuesday at 9 a.m.', [
    'Take the day off and go',
    'Pay an agency to do it',
  ]),
  red_works_stopped: c('Works stopped', 'A notice on the door: your renovation lacks the permit the council changed last month.', [
    'Wait for it to be sorted',
    'Pay the extra fee and carry on',
  ]),
  red_inheritance: c('An inheritance in limbo', 'A distant aunt leaves you something. Between notaries, duties and stamps, collecting it is another story.', [
    'Pay the duty and collect now',
    ['Wait for the paperwork', 'It arrives whole, if late.', 'Between deadlines and surcharges, half of half arrives.'],
  ]),
  red_grant: c('A grant', 'There is help for businesses like yours. The form runs to forty pages.', [
    'Not worth it',
    ['Fill it all in', 'You get it.', 'A stamp is missing. Refused.'],
  ]),
  refuge_bank_freeze: c('Bank freeze', 'The banks limit cash withdrawals "for your safety". The queues go round the block.', [
    'Queue and wait',
    'Borrow from the family',
    'Fall back on your gold',
    'Pay in crypto',
  ]),
  // The famous, as parodies.
  celeb_mosk: c('Elon Mosk wants your business', 'He saw it in a post. In a reply, he offers three times what it is worth.', [
    'Say no',
    ['Shake on it', 'He pays. Three times over. You frame the post.', 'He changes his mind in a later post. The lawyer still sends you the bill.'],
  ]),
  celeb_grump: c('A flat in Grump Tower', 'Ronald Grump shows you round himself: "The best flats. Everybody says so." They cost 30% more than the one next door.', [
    'Keep looking',
    ['Sign', 'Gold taps, a doorman and the name over the door. People notice.', 'A week later his name comes off the building. It is just a flat now, and a dear one.'],
  ]),
  celeb_poutine: c('An oligarch\'s yacht, cheap', 'A nervous man must sell his yacht this week, far below its price. Vladimir Poutine watches from the far end of a very long table.', [
    'Not your boat',
    ['Buy it', 'It is yours, and nobody asks where it came from.', 'Sanctions freeze it at the quay. The lawyers who get it back cost a fortune.'],
  ]),
  celeb_bufe: c('Lunch with Warren Bufé', 'The old investor buys you a burger and a cherry cola. You may ask him one thing.', [
    'Talk about the weather',
    'Ask how he did it',
    'Ask what to buy',
  ]),
  celeb_bozos: c('Sell through Jeff Bozos', 'His platform would take your business to every doorstep in the country. For thirty percent of each sale.', [
    'Stay independent',
    ['Join the platform', 'Orders from everywhere. Your business has never been worth more.', 'He copies your best seller and sells it cheaper. You lose ground.'],
  ]),
  celeb_zuckerbot: c('Land in the metaverse', 'Mark Zuckerbot is selling plots in his virtual world: "Everyone will live here." You would be among the first.', [
    'Stay in the real world',
    ['Buy a plot', 'A brand buys your plot for its virtual shop. You sell, and wonder.', 'The metaverse empties. Your plot is a square of green pixels nobody visits.'],
  ]),
  celeb_puertas: c('A gala with Bill Puertas', 'He passes the jar at a charity gala, and the room goes quiet as it reaches you.', [
    'Pass it on',
    'Give a tenth of everything you have',
    'Give a little',
  ]),
  celeb_nakamoro: c('An old laptop in the attic', 'It has a coin wallet from the early days on it. Locked. The password is something you would have used back then.', [
    'Leave it in the box',
    ['Try every password you ever had', 'It opens. You sell before your hands stop shaking.', 'Nothing works. A weekend gone, and a hooded figure smiling in the black screen.'],
  ]),
  celeb_kardashion: c('A sponsored post', 'Kim Kardashion wants you to hold her new water in a photo: "Just smile and say it changed your life."', [
    'Say no',
    'Do the post',
    'Do it properly, for your followers',
  ]),
  celeb_mrfeast: c('A challenge by MrFeast', 'The last one standing in a circle of light for a week wins a fortune. Millions will watch.', [
    'Watch it at home',
    ['Take part', 'You are the last one standing. The cheque is enormous, and real.', 'You last eleven hours. The clip of you giving up has eight million views.'],
  ]),
  celeb_ronalgo: c('Cristiano Ronalgo\'s underwear line', 'His manager is raising money for a new line: "It sells itself. Look at him."', [
    'Not your style',
    ['Put money in', 'It sells everywhere. A cheque comes every year.', 'Fashion moves on. The boxes of stock do not.'],
  ]),
  celeb_swiftly: c('Taylor Swiftly is on tour', 'The tickets sold out in a minute. You got two, at a price that makes you sit down.', [
    'Give them away',
    'Go to the concert',
    ['Sell them on', 'They go for far more. Someone cried with joy.', 'They were fakes. The night is lost, and the money with it.'],
  ]),
  celeb_bellfort: c('A call from Jordan Bellfort', '"I\'ve got a stock for you that only goes up. Only goes up." He talks fast. You have a minute.', [
    'Hang up',
    ['Buy what he sells', 'Somehow it goes up. You sell, and never pick up again.', 'The company does not exist. Neither, now, does your money.'],
  ]),
  celeb_ortiga: c('Amancio Ortiga opens across the street', 'A big new store, right in front of your business. He comes over himself: "Or you could join us."', [
    'Hold your ground',
    'Take his franchise',
  ]),
  luck_barn_car: c('A classic in the barn', 'In grandpa\'s barn, under a tarp, there is a sports car from the seventies. Dusty, and whole.', [
    'Sell it as it is',
    ['Restore it and sell it', 'A collector pays what it is worth, and then some.', 'The engine was worse than it looked. You get little.'],
    'Restore it and keep it',
  ]),
  life_mlm: c('"Ever thought of being your own boss?"', 'A school friend writes for the first time in ten years. She sells shakes and is looking for "partners".', [
    'Say no',
    ['Buy the starter kit', 'You sell more than you thought. Mostly to your family.', 'You sell one to your mum. The rest goes in the storeroom.'],
    ['Buy the kit and recruit others', 'Your network grows and the commissions come. Your friends avoid you.', 'Nobody joins. And nobody picks up your calls any more.'],
  ]),
  house_squatters: c('Squatters in your flat', 'The flat you let was empty between tenants. Not any more: the lock has been changed.', [
    'Go to court',
    'Pay them to leave',
    ['Call in a removal firm', 'One visit, and they are gone that afternoon.', 'It is on the news. So are you.'],
  ]),
  house_solar: c('Solar panels', 'An installer has been round the estate: with your roof, he says, power would cost almost nothing.', [
    'Keep the usual bill',
    'Put them in',
    'Put them in with a battery',
  ]),
  fam_village_house: c('The house in the village', 'The family house in the village is left to you. The roof leaks and the fig tree gives figs.', [
    'Sell it as it is',
    'Do it up for the summers',
    'Do it up and let it to visitors',
  ]),
  career_company_ipo: c('Your company goes public', 'The company lists and your employee shares are finally worth something. You can sell on the first day, or wait.', [
    'Sell it all on day one',
    ['Hold for six months', 'The shares soar. Some people stop working.', 'They stay where they were.', 'They fall below the listing price.'],
    ['Sell half', 'The half you kept does well.', 'The half you kept comes to nothing.'],
  ]),
  biz_metro_works: c('Works outside your business', 'The council digs a trench outside your door for a metro line. Two years, they say.', [
    'Put up with it',
    ['Claim from the council', 'You get compensation. Late, but it comes.', 'They give you an appointment in a year.'],
    'Start delivering',
  ]),
  career_strike: c('A strike at work', 'A strike is called over pay. The boss asks, without asking, who is coming in.', [
    ['Go to work', 'The boss remembers who came in.', 'Nobody remembers anything. Except your colleagues.'],
    ['Join the strike', 'It works: everyone gets a raise.', 'Nothing comes of it. You lose the day.'],
    ['Be the one who negotiates', 'You come out with a deal, and a name.', 'The company remembers you. Not kindly.'],
  ]),
  life_school_reunion: c('The school reunion', 'Twenty years on, dinner with the class. Everyone knows who will say they are doing great.', [
    'Do not go',
    'Go and look the part',
    ['Go and tell it as it is', 'Someone from the class is looking for someone like you.', 'You laugh a lot. Nothing more, and nothing less.'],
  ]),
  fam_child_streamer: c('Your child wants to stream', 'Your child wants to drop everything and stream. They need a computer, a camera, a mic and lights.', [
    'Studies first',
    ['Buy the kit', 'A stream goes viral. Sponsors are calling.', 'Twelve viewers. Three are family.'],
    ['Buy the kit and run the channel', 'With contracts and a schedule, you smash it.', 'Twelve viewers, and a very involved manager.'],
  ]),
  life_stag_party: c('The stag party is yours to organise', 'Your best friend is getting married and the party falls to you. The group is already talking about Las Vegas.', [
    'Get out of it',
    'Something simple, here',
    'Go big, in Las Vegas',
  ]),
  career_linkedin_post: c('The LinkedIn post', 'You have written a post on "what I learnt when everything went wrong". It only needs publishing.', [
    'Delete it',
    ['Publish it', 'It is shared thousands of times. Two companies get in touch.', 'A few likes and some new contacts.', 'Your colleagues read it aloud in the office.'],
  ]),
  life_podcast: c('A podcast invites you', 'A personal finance podcast wants to interview you. They know you understand money.', [
    'Say no',
    ['Just go', 'A good talk. Listeners write to you.', 'Ten seconds of you saying something silly goes viral.'],
    ['Prepare properly', 'You had your numbers ready, and it shows.', 'Even so, someone clips the wrong sentence.'],
  ]),
  career_ai_agent: c('An AI for your job', 'The company is trying an AI agent that does much of your work. You are the one who must teach it.', [
    ['Carry on as before', 'The trial fails to convince. Nothing changes.', 'It works. You are moved to something that pays less.'],
    'Learn to run it',
    ['Put yourself into what the machine cannot do', 'Dealing with people is still yours.', 'The machine learns to negotiate too.'],
  ]),
  life_gig_apps: c('Weekends with an app', 'The delivery and ride apps are looking for people at weekends.', [
    'Rest at weekends',
    'Deliver by bike',
    ['Drive your own car', 'Two years of rides without a scratch.', 'A silly bump at a roundabout. The insurance does not cover work.'],
  ]),
  inv_copy_trading: c('Copy a trader', 'A trader on social media shows 400% in a year. An app copies their trades into your account automatically.', [
    'Leave it',
    ['Try a little', 'It goes well. For now.', 'You get half back.', 'The trader deletes the account. And your money with it.'],
    ['Go in properly', 'You triple what you put in.', 'You get half back.', 'The trader deletes the account. And your money with it.'],
  ]),
  luck_hacked: c('You have been hacked', 'Your email is taken over and they want a ransom for your photos and documents.', [
    'Change every password and start again',
    ['Pay the ransom', 'You get your access back.', 'You pay, and they still post some photos.'],
    ['Report it', 'The police shut the thieves\' account in time.', 'Before anything happens, your photos are already out.'],
  ]),
  fam_signal_group: c('Your in-law\'s group', 'Your partner\'s father adds you to a WhatsApp group that invests on the "signals" of an anonymous guru.', [
    'Mute the group',
    'Leave the group',
    ['Follow the signals', 'One signal comes good. Your in-law reminds you at every meal.', 'Almost all of it is lost. Nobody in the group mentions it again.'],
  ]),
  house_remote_outskirts: c('A house an hour out, with fibre', 'You work from home and pay rent in the city. An hour away there are houses with gardens and fibre for less than half.', [
    'Stay in the city',
    'Buy a house out of town',
  ]),
  house_back_home: c('Back to your parents\' place', 'Past thirty and short of money, your parents offer you your old room. No rent.', [
    'Keep renting',
    'Move back for a couple of years',
    'Move back for just a year',
  ]),
  life_midlife: c('The midlife crisis', 'You look in the mirror and something has to change. Now.', [
    'Go to therapy',
    'A motorbike, a tattoo and a trip',
    'Take unpaid leave and go round the world',
  ]),
  fam_grandchild: c('Your first grandchild', 'You are going to be a grandparent. The new parents are worn out and short of money.', [
    'Congratulate them, and that is all',
    'Help them with money',
    'Look after the baby a few days a week',
  ]),
  life_black_card: c('The black card', 'The bank offers you its most exclusive card: heavy metal, airport lounges and a yearly fee to match.', [
    'No, thanks',
    'Take it',
    'Take it and christen it in style',
  ]),
  fam_piggy_bank: c('The piggy bank', 'Your child has broken the piggy bank and wants to "invest like grown-ups".', [
    'Put it away in a drawer',
    'Open them an account in an index fund',
    'Teach them how money works',
  ]),
  house_lift_levy: c('The residents vote on an upgrade', 'The neighbours vote on a lift and new access. There is a levy, and your home will be worth more.', [
    ['Vote against', 'It does not pass. Until the next meeting.', 'It passes anyway. You pay your share.'],
    'Vote for it',
  ]),
  biz_street_contest: c('The neighbourhood contest', 'The neighbourhood gives a prize for the best terrace and shopfront. The prize is customers.', [
    'Stay out of it',
    ['Go for the prize', 'You win. The local paper runs it and the till notices.', 'Mid-table. Some new customers, at least.'],
  ]),
  career_xmas_dinner: c('The Christmas dinner', 'The company dinner is on its third wine. The boss is alone at the bar.', [
    'Leave early',
    'Stay and make contacts',
    ['Tell the boss what you think', 'They listen, and in January your pay goes up.', 'Tomorrow nobody meets your eye.', 'In January you are moved off the good projects. And the bonus.'],
  ]),
  career_sabbatical: c('A sabbatical year', 'The company offers a year off without pay to whoever wants one. Your job is kept for you. Or one like it.', [
    'No, thanks',
    ['Take the year', 'You go back to the same desk, a new person.', 'Someone else does your job now. You get a slightly worse one.'],
  ]),
  career_credit_stolen: c('They take your credit', 'A colleague presents your project as theirs to the management.', [
    'Say nothing',
    ['Confront them', 'You set it straight in front of everyone. Management notices.', 'It looks like a fight. Nobody comes out well.'],
    ['Go to HR with proof', 'The proof speaks. The project is yours again.', 'They tell you it is "a team thing".'],
  ]),
  luck_office_pool: c('The office pool', 'Everyone puts in twenty and you keep the ticket. It has won.', [
    'Share the prize',
    ['Say it did not win', 'Nobody ever checks.', 'Somebody checks.'],
  ]),
  life_cooking_show: c('A TV cooking contest', 'A cooking show is looking for contestants. Your friends say your omelette deserves television.', [
    'Let it be',
    ['Apply', 'You win. A prize and interviews.', 'You go far. The neighbourhood knows you.', 'Your omelette burns live on air.'],
    ['Apply and train hard', 'You win. A prize and interviews.', 'You go far. The neighbourhood knows you.', 'Nerves get the better of you.'],
  ]),
  luck_viral_bad: c('Viral, the wrong way', 'Someone filmed your argument in a bar and the video goes round the world. You have a nickname now.', [
    'Vanish from social media',
    ['Apologise on video', 'People forgive you. They even like you.', 'Nobody watches it. The original keeps going round.'],
    ['Cash in and sell T-shirts', 'The T-shirts sell out. Twice.', 'You sell a few. The fame you keep in full.'],
  ]),
  biz_influencer_review: c('An influencer wants free meals', 'A local influencer offers you a glowing review in exchange for eating free all year.', [
    ['Say no', 'Nothing happens. They forget all about it.', 'They post a terrible review. Out of spite.'],
    ['Take the deal', 'The review works: there is a queue at the door.', 'A few new customers. And one regular who never pays.'],
  ]),
  health_smartwatch: c('Your watch warns you', 'Your smartwatch flags an odd heart rhythm. Twice this week.', [
    ['Think the watch is exaggerating', 'It was.', 'It was not. A scare in A&E.'],
    'Have a doctor look at it',
  ]),
  house_festival_rental: c('The festival comes to town', 'A huge festival comes to town and someone offers a fortune for your home for a week.', [
    'Stay at home',
    ['Let it for the week', 'It comes back spotless. With flowers, even.', 'It comes back with a party in it. Time to repaint.'],
  ]),
  fam_school_treasurer: c('Treasurer of the parents\' group', 'The school\'s parents\' group asks you to keep the accounts. Nobody else raises a hand.', [
    'Get out of it',
    'Accept',
    'Accept and organise the end-of-year party',
  ]),
  luck_drone_crash: c('A drone on your terrace', 'A drone crashes on your terrace. Its owner rings the bell and offers to pay you not to report it.', [
    'Just give the drone back',
    'Take the money',
    ['Report it', 'You are paid for the damage, and well.', 'The report gets lost in a drawer.'],
  ]),
  life_concert: c('Your favourite band plays in town', 'Tickets sold out in a minute. Resale ones are left, at three times the price.', [
    'Miss it',
    'Pay the resale price',
    'Front row, and the party after',
  ]),
  luck_police_auction: c('The police auction', 'The police are auctioning what they seized: cars, watches, even a jet ski.', [
    'Look and do not bid',
    ['Bid on a car', 'You sell it on at a profit within a month.', 'It was a wreck. You sell it for parts.'],
    ['Bid on a luxury watch', 'Genuine. And on your wrist.', 'Fake. You sell it on as one.'],
  ]),
  house_protected_flat: c('You win a protected flat', 'You have been drawn in the protected housing lottery: a flat at well below the market price.', [
    'Give it up',
    'Buy it',
  ]),
  career_startup_advisor: c('Adviser for shares', 'A startup wants financial advice at weekends. They cannot pay you: they offer shares.', [
    'Say no',
    ['Take the shares', 'The startup folds. The shares are worth nothing.', 'A big company buys it. Something comes your way.', 'It becomes one of the big ones. So do your shares.'],
  ]),
  house_upstairs_leak: c('The neighbour upstairs floods you', 'A pipe bursts upstairs and your ceiling drips. Their insurer says it will pay. Some day.', [
    ['Wait for their insurer', 'The insurer pays and the work is done.', 'Months of damp. In the end, you pay for part of the work.'],
    ['Pay for the work yourself first', 'The insurer pays you back in full.', 'The insurer finds a clause. You pay.'],
  ]),
  career_transfer_asia: c('The office in Asia', 'Your company is opening an office in {city:singapore} and wants someone it trusts to set it up. The move is paid.', [
    'Stay where you are',
    'Go to {city:singapore}',
  ]),
  life_digital_nomad: c('Digital nomad', 'You work from home. Home could be a beach in Thailand, on the same pay and half the costs.', [
    'Stay',
    'Go to {city:bangkok}',
  ]),
  career_offer_madrid: c('An offer in {city:madrid}', 'A company in {city:madrid} offers you the same rung, better hours and a little more pay. And terraces.', [
    'No, thanks',
    'Accept and go to {city:madrid}',
  ]),
  city_tokyo_lifetime: c('A job for life', 'Your company offers you a contract until you retire. In return, nobody goes home before the boss.', [
    'Stay as you are',
    'Sign for life',
  ]),
  city_zurich_savings: c('The Swiss bank\'s plan', 'The bank offers you a ten-year plan: a low rate, but safe as a vault.', [
    'No, thanks',
    'Put $10,000 into the plan',
  ]),
  city_london_flatshare: c('The flatshare', 'Your flatmate is leaving and the landlord will not lower the rent. Someone has to pay for the empty room.', [
    'Pay both shares for a while',
    ['Find a new flatmate', 'You find someone in a week. They even do the washing up.', 'Nobody who is not alarming. You pay meanwhile.'],
    'Move out to the suburbs',
  ]),
  // The troubles of a fortune.
  rich_lawsuit: c('A lawsuit', 'A man you have never met says part of your fortune is his. His lawyers have a press office.', [
    'Settle out of court',
    ['Fight it in court', 'The judge throws it out. Your lawyers send their bill.', 'You lose, and the papers print the figure.'],
    'Negotiate it down yourself',
    ['Take the case yourself', 'You win, and in the robes it suits you.', 'The judge was not impressed. Neither was the client.'],
  ]),
  rich_scandal: c('A photo from the wrong party', 'A picture of you with the wrong people, from years ago, is everywhere this morning.', [
    'Ride it out',
    ['Hire a PR firm', 'A week later, nobody remembers.', 'The firm\'s denial is more famous than the photo.'],
    ['Apologise on prime time', 'Tears, a dog, a cause. People like you more than before.', 'It sounded rehearsed. The clip of it is a meme.'],
  ]),
  rich_tax_squad: c('The unit for large fortunes', 'The tax office has a team for people like you now. They would like to see everything, going back years.', [
    'Open every book',
    ['Hire the big firm of tax advisers', 'Their fees are the only thing found.', 'They argue well. The inspectors dig deeper.'],
    ['Fight them in court', 'The case falls on a technicality.', 'You lose, and now they watch you.'],
  ]),
  rich_partner_swindle: c('Your partner, twice paid', 'Someone at the business hints that your partner has been paying himself twice for years.', [
    ['Trust him', 'It was gossip. He brings you a cake.', 'It was true. Half the business is in his name now.'],
    ['Call in the auditors', 'The books are clean. The auditors are not cheap.', 'Caught early, and it still hurts.'],
    ['Go through the books yourself', 'Every number adds up. You sleep well.', 'You find it on page forty. Less gone than it could be.'],
  ]),
  rich_divorce: c('A divorce for the papers', 'Your marriage is over, and with your money, it is news.', [
    'Settle quietly',
    ['Fight it in court', 'Your lawyers earn their fee. You keep most of it.', 'Every hearing on the front page, and half of everything gone.'],
    ['Try one last time', 'A long trip and a lot of talking. You stay together.', 'It only made the ending more expensive.'],
  ]),
  rich_gala: c('The charity gala', 'A seat at the gala costs nothing. What you pledge at the table is read out loud.', [
    'Decline the invitation',
    'Pledge something generous',
    'Fund a hospital wing',
  ]),
  rich_uncle_castle: c('A great-uncle\'s castle', 'A great-uncle you never knew leaves you a castle. And, the notary says, whatever he owed.', [
    'Renounce the inheritance',
    ['Accept it and sell it all', 'A hotel chain buys it. The debts were small.', 'The debts were not small. Neither is the bill.'],
    ['Keep the castle', 'The castle is yours, let out for weddings: a title, a tower and a roof that leaks.', 'The roof, and then the creditors, arrive together.'],
  ]),
  rich_yacht_rocks: c('The boat on the rocks', 'The skipper took your boat out for a party of his own and left it on the rocks. With guests aboard.', [
    'Pay everyone off quietly',
    ['Let the lawyers fight it', 'The skipper takes the blame. Rightly.', 'The guests win, and the photos of the wreck go round.'],
  ]),
  rich_threat: c('A letter with no name', 'It knows where you live, and where the children go to school. It wants money.', [
    ['Ignore it', 'Nothing happens. It was a bored teenager.', 'Someone gets into the house. The police are very sorry.'],
    'Hire bodyguards',
  ]),
  rich_hostile_bid: c('A bid for your business', 'A rival ten times your size wants your business, and says it can make things hard if you say no.', [
    ['Turn it down', 'They make noise, then they lose interest.', 'They open next door, and take your best people.'],
    'Sell at their price',
    'Fight them off',
  ]),
  // Content 1.50: the people who come back, and the player's own.
  inlaw_coin: c('A coin with a rat on it', '{person:inlaw} shows you his phone: $RATA, a coin with a rat on it. "It can only go up," he says.', [
    'Politely say no',
    'Put a little in',
    'Ask him what it actually does',
  ]),
  inlaw_moon: c('To the moon', 'A screenshot at three in the morning: $RATA is up five times. {person:inlaw} has added rockets.', [
    ['Hold: it can only go up', 'You hold. {person:inlaw} sends a rocket every morning.', 'It goes twenty times. You sell at the top, shaking.'],
    'Sell it all',
    ['Sell half, hold the rest', 'Half is safe. The other half rides with {person:inlaw}.', 'The half you held goes twenty times. You sell it, shaking.'],
  ]),
  inlaw_dinner: c('Dinner with the family', '{person:inlaw} stands up at dinner, phone in hand: $RATA is up five times. Everyone looks at you.', [
    'Pass the potatoes',
    ['Ask him to put you in now', 'You bought the top. Next week, so does everyone.', 'You sell a week later, at the very top. Pure luck.'],
    'Tell the table it is a bubble',
  ]),
  inlaw_rug: c('$RATA goes to zero', 'The coin lost everything overnight. {person:inlaw} sits on a park bench, refreshing the price.', [
    'Let him be',
    'Bring two coffees and sit with him',
  ]),
  inlaw_loan: c('A knock in the rain', '{person:inlaw} at your door, soaked. He needs money for the rent, and swears it is the last time.', [
    'Say no',
    'Lend him what he needs',
    'Give him a little, as a gift',
    'Lend it, and have him sign for it',
  ]),
  inlaw_repay: c('An envelope with your name', '{person:inlaw} has a job now, a haircut and an envelope with your name on it.', [
    ['Take the envelope', 'All of it, and the coffee is on him.', 'Part of it, and a promise for the rest.'],
    'Tell him to keep it',
    'Hand him the paper and take the envelope',
  ]),
  boss_weekend: c('The weekend project', 'Friday, six o\'clock. {person:boss} drops a binder on your desk: the client wants it on Monday.', [
    'Say you have plans',
    'Cover the weekend',
  ]),
  boss_offer: c('An office abroad', '{person:boss} is opening an office abroad, and wants someone she can trust there, a rung up.', [
    'Thank her and stay',
    'Pack for {city:london}',
    'Pack for {city:new_york}',
  ]),
  boss_layoffs: c('A list in the corridor', 'Boxes in the corridor and a manager with a list. {person:boss} is in the room where it is drawn up.', [
    ['Wait for the list', 'Your name is not on it.', 'Your name is on it.'],
    'Ask her for her word',
    'Take the voluntary package',
  ]),
  landlord_damp: c('A stain on the ceiling', 'A black stain is spreading over the bed. {person:landlord} looks at it and calls it "character".', [
    'Put up with it',
    ['Complain in writing', 'He fixes it, slowly, and remembers who asked.', 'He fixes nothing, and remembers who asked.'],
    'Fix it yourself',
  ]),
  landlord_raise: c('A letter from the landlord', '{person:landlord} at the door with a letter. The rent is going up, he says, as everything does.', [
    'Pay the new rent',
    ['Negotiate', 'He meets you halfway, grumbling.', 'He will not move, and now he is cross.'],
    'Find another flat',
  ]),
  landlord_sale: c('The flat, at a friend\'s price', '{person:landlord} is retiring to the coast. He would rather sell you the flat than sell it to a stranger.', [
    'Keep renting',
    'Buy it with a mortgage',
    'Buy it outright',
  ]),
  founder_pitch: c('An app for splitting bills', '{person:founder}, from your old class, is building an app to split bills among friends. She needs her first money.', [
    'Wish her luck',
    'Invest a little',
    'Help her at weekends',
  ]),
  founder_more: c('A little more', 'The app has users and no money left. {person:founder} needs as much again to last two more years.', [
    'Say that was all',
    'Put in as much again',
  ]),
  founder_exit: c('News from the startup', 'Two years on, {person:founder} calls. She has news about the company, and it is big either way.', [
    ['Hear the news', 'It closes. She carries out the last box herself.', 'A small sale: twice your money back.', 'A giant buys it, at ten times. Champagne in the office.'],
    'Sell your shares to a fund first',
  ]),
  founder_second: c('A second idea', '{person:founder} is back, with boxes, stickers and a second idea: the same app, for dogs.', [
    'Wish her luck',
    ['Invest a little again', 'It closes too. She thanks you anyway.', 'Second time lucky: five times your money.'],
    'Introduce her to people',
  ]),
  advisor_fund: c('A guaranteed fund', '{person:advisor}, from the bank, has a fund for you: guaranteed, he says, and with a very small fee.', [
    'No, thanks',
    'Sign up',
    'Ask for an index fund instead',
  ]),
  advisor_insurance: c('Insurance with the mortgage', 'Your home has no insurance, {person:advisor} points out. A fire would be all yours. The bank can sign you up today, for a commission.', [
    'Stay uninsured',
    'Sign with the bank',
    'Find the same cover yourself',
    'Sign with the bank at the client rate',
  ]),
  parents_help: c('A little help', '{person:parents} have saved a little. If it helps with a deposit for a home of your own, it is yours.', [
    'Say you will manage',
    'Accept it, gratefully',
  ]),
  parents_care: c('Your parents need help', 'Your father fell on the stairs, and your mother cannot lift him. They need help every day now.', [
    'Pay for a care home',
    'Look after them yourself',
  ]),
  parents_inheritance: c('At the notary', 'A photo, a set of keys and a folder: what your parents left. The folder also holds what they owed. Nobody knows how much.', [
    'Renounce it all',
    ['Accept it as it comes, debts and all', 'The flat, some savings, and no debts.', 'The flat was mortgaged twice. The debts beat the estate, and you pay the rest.'],
    'Accept it: you know their papers',
    ['Accept it only up to what it is worth', 'The notary takes a fee. Then the flat and some savings, no debts.', 'The debts eat the estate and stop there. You lose only the fee.'],
  ]),
  cousin_wedding: c('A wedding invitation', 'An invitation with gold edges, from {rival:cousin}. A wedding, and a list of gifts.', [
    'Something small',
    'A fair gift',
    'Something lavish',
  ]),
  ex_new_car: c('The ex in a convertible', 'A convertible stops by your bus stop. At the wheel, waving: {rival:ex}.', [
    'Wave back and wait for the bus',
    'Buy a car to match',
    'Rent one for a weekend and post it',
  ]),
  classmate_job: c('A job at a friend\'s firm', 'Coffee with {rival:classmate}. The firm is hiring, and the job is yours if you want it.', [
    'Stay where you are',
    ['Take the job', 'A new badge, better pay, and a friend on the same floor.', 'A year in, the firm is in trouble, and so is your pay.'],
    'Take it, at your price',
  ]),
  // The people, deeper (cards-54).
  classmate_housewarming: c('A housewarming', 'Drinks at the flat just bought by {rival:classmate}. He shows you the boiler as if it were a newborn.', [
    'Bring a plant and go home',
    'Start looking at flats yourself',
    'Ask him how he did it',
  ]),
  cousin_yacht: c('A weekend on a yacht', 'From {rival:cousin}: her new boyfriend has chartered a yacht and is already toasting everyone. The small print says the bill is split.', [
    'Make an excuse in time',
    'Go, and pay your share',
    'Go, pay, and post the photos',
  ]),
  parents_visit: c('A visit from home', '{person:parents} come for the weekend and look round your home. Your mother runs a finger along a shelf.', [
    'Take them out for a nice dinner',
    'Let them fix things, as they insist',
    'Ask them to stay the week',
  ]),
  founder_bell: c('The opening bell', '{person:founder} rings the bell on her company\'s first day on the stock exchange. She waves at you from the stage.', [
    'Cheer from the floor',
    ['Buy some shares on day one', 'By evening the shares are worth less than lunch.', 'A good first day, and a good first year.', 'The shares go to the moon, and take you with them.'],
    ['Ask her for a job', 'She takes you on, at a better salary.', 'She laughs, kindly, and pays for the coffee.'],
  ]),
  boss_retire: c('A retirement', '{person:boss} is retiring to grow tomatoes. She holds out her address book: "I won\'t need it any more."', [
    'Have a farewell coffee',
    'Take her contacts',
    'Ask her to look over your business',
  ]),
  // Content 1.50: the lodger's party and leaving.
  lodger_party: c('The lodger\'s party', 'You come back from a weekend away. The lodger threw a party. The sofa did not survive.', [
    'Let it go',
    ['Make the lodger pay for it', 'They pay, sulking, and stay.', 'They pay, and move out a month later.'],
  ]),
  lodger_leaves: c('The lodger moves out', 'The lodger has found a place of their own, and hands back the key with a small present, a box of plants under one arm.', [
    'Keep the deposit for the paint',
    'Give the deposit back',
  ]),
  // Content 1.50: a fortune's fake masterpiece.
  rich_fake_art: c('A masterpiece, of sorts', 'An expert squints at your painting through a magnifying glass. Then he asks where you bought it.', [
    ['Keep quiet, and keep it on the wall', 'Nobody else ever looks that closely.', 'A guest at dinner looks that closely.'],
    ['Sue the gallery', 'The gallery pays, and apologises in print.', 'The gallery has vanished. So have its owners.'],
    'Give it to a museum, as a fake',
  ]),
  // Content 1.52: the four careers added last, four cards each.
  aviation_medical: c('The yearly medical', 'The doctor at the yearly check hears a murmur in your heart. Without a specialist\'s word, your licence waits.', [
    'Wait to be cleared',
    'Pay a specialist',
  ]),
  aviation_strike: c('The pilots strike', 'The union calls a strike over pay. The airline needs someone to fly the morning flights.', [
    'Fly the morning flight',
    ['Join the strike', 'The airline gives in: a raise for every pilot.', 'Nothing comes of it, and the days on strike are not paid.'],
  ]),
  aviation_base_abroad: c('A base abroad', 'The airline is opening bases at its two hubs and asks who will move with the job. The move is paid.', [
    'Stay where you are',
    'Move to the base in {city:dubai}',
    'Move to the base in {city:singapore}',
  ]),
  aviation_grounded: c('The fleet is grounded', 'Nobody is flying in this recession. Half the fleet is parked in the desert, and the airline asks pilots to wait.', [
    'Wait on half pay',
    'Fly cargo instead',
  ]),
  construction_own_house: c('A house of your own design', 'You have drawn houses for others for years. A plot comes up, and the builder you trust offers you the trade price.', [
    'Keep drawing for others',
    'Build your own house',
  ]),
  construction_unpaid: c('The developer will not pay', 'The building is up, and the developer has stopped answering the phone. Your fee is in his pocket.', [
    'Let it go',
    ['Take him to court', 'The court rules for you: the fee, with interest.', 'The developer goes bust. The lawyers still get paid.'],
  ]),
  construction_collapse: c('A crack in the balcony', 'A balcony in a block you signed has cracked. Nobody was hurt, and the papers already know your name.', [
    'Pay for the repair',
    ['Blame the builder', 'The report agrees: the builder skimped on steel.', 'The report blames the design. The repair and the shame are yours.'],
  ]),
  construction_famous_client: c('A famous client', 'A pop star wants a villa on a cliff, all glass, and wants you to draw it.', [
    'Turn it down',
    'Draw the villa',
  ]),
  realestate_off_market: c('Off the market', 'A landlord wants to sell a let flat quietly, before it is listed. You are the first to know.', [
    'Pass it to a client',
    'Buy it yourself',
  ]),
  realestate_hurried_seller: c('A seller in a hurry', 'A seller has to be gone by the end of the month and will take any fair offer.', [
    'Let a colleague handle it',
    'Tip off your investor client',
    'Buy it to live in',
  ]),
  realestate_bubble: c('Talk of a bubble', 'Prices have never been higher, and at the agency everyone says the top is near.', [
    'Hold on',
    'Sell your home at the top',
  ]),
  realestate_double_fee: c('Two fees for one sale', 'The buyer and the seller each offer you a fee, and neither knows about the other.', [
    'Play it straight',
    ['Take both fees', 'Nobody finds out. Two fees for one sale.', 'The buyer finds out: a fine, and your name in the trade press.'],
  ]),
  military_mission: c('A mission abroad', 'The unit is sent abroad for six months. Volunteers get a bonus, and the others get noticed.', [
    'Stay behind',
    ['Volunteer', 'Six hard months, and you come back with a bonus and a medal.', 'You come back with a bonus, a medal and an injury that still aches.'],
  ]),
  military_twenty_years: c('Twenty years of service', 'Twenty years in uniform. You may leave now with a pension for life, and the civil service has a desk for you.', [
    'Stay on',
    'Leave with the pension',
  ]),
  military_posting: c('A new posting', 'The army is moving your unit abroad. The move is paid, and asking to stay is asking for a favour.', [
    'Ask to stay',
    'Go with the unit to {city:dubai}',
    'Go with the unit to {city:london}',
  ]),
  military_contractor: c('The contractor\'s offer', 'A private security firm wants officers like you abroad, at a pay the army never dreamt of.', [
    'Stay in the army',
    'Take the contract',
  ]),
  // Content 1.52: three cards for each of the eleven careers before the four added last.
  healthcare_assault: c('Attacked in A&E', 'A patient\'s relative hits you on a night shift in A&E. At the end of it, your hands are still shaking.', [
    'Carry on as if nothing happened',
    ['Report it', 'The hospital backs you, and security is doubled.', 'The report is filed, and nothing changes.'],
    'Ask to move to a ward',
  ]),
  healthcare_post_away: c('A post for good', 'Two big hospitals offer you a permanent post, with better pay. Both are in other cities.', [
    'Stay where you are',
    'Take the post in {city:madrid}',
    'Take the post in {city:london}',
  ]),
  healthcare_icu: c('The ICU needs people', 'Intensive care is short of nurses. The pay is better, and the nights are long and hard.', [
    'Stay on the ward',
    'Move to the ICU',
  ]),
  tech_stock_options: c('Your stock options', 'The company talks of going public. You can sell your stock options now, or keep them for the listing.', [
    'Sell them now',
    ['Hold on for the listing', 'The listing soars. Your options are worth three times as much.', 'The listing is called off, and the options expire worthless.'],
  ]),
  tech_layoffs: c('Mass layoffs', 'The company is cutting a fifth of its staff, and asks for volunteers first, with a payoff.', [
    ['Keep your head down', 'You survive the cuts, with twice the work.', 'You keep the job, on a new contract that pays less.'],
    'Take the payoff',
  ]),
  tech_new_york: c('A call from New York', 'A headhunter has a big tech firm in New York that wants you: far more pay, but a rung lower to start.', [
    'Hang up',
    'Move to {city:new_york}',
    ['Use it to ask for a raise', 'Your boss matches part of it. You stay, and earn more.', 'Your boss wishes you luck in New York. Nothing changes.'],
  ]),
  public_exam: c('The senior corps exam', 'The exam for the senior corps is called: two years of evenings with the syllabus, and few places.', [
    'Let it pass',
    ['Prepare for it', 'You pass, high on the list: a better post and a better title.', 'You miss it by a few points. The syllabus goes back on the shelf.'],
  ]),
  public_pay_cut: c('A pay cut for the civil service', 'The budget is short, and the government cuts civil servants\' pay. The unions call a strike.', [
    'Accept it',
    ['Go on strike', 'The government backs down. There is no cut.', 'The cut goes ahead, and the strike days are not paid.'],
  ]),
  public_abroad: c('An international post', 'An international body wants civil servants for its offices, with an allowance for the first years.', [
    'Stay where you are',
    'Go to {city:madrid}',
    'Go to {city:moscow}',
  ]),
  service_app_cut: c('The app cuts its rates', 'From Monday the delivery app pays less per order. The riders grumble, and some are switching.', [
    'Put up with it',
    ['Switch to another app', 'The new app pays what the old one did. For now.', 'A month later, the new app cuts its rates too.'],
  ]),
  service_strike: c('The riders\' strike', 'The riders strike for a fair rate. With so few on the road, every order pays double.', [
    'Keep riding',
    ['Join the strike', 'The app gives in: a better rate per order, for good.', 'The app waits it out. A week without pay, for nothing.'],
  ]),
  service_on_call: c('Always on call', 'The company offers you the next rung at once, if you answer the phone at any hour, every day.', [
    'Keep your evenings',
    'Take the rung',
  ]),
  finance_bonus: c('The year\'s bonus', 'A good year for the bank. Your bonus can be paid in cash, or in the bank\'s own shares, locked for two years.', [
    'Take it in cash',
    ['Take it in shares', 'The shares double. Your bonus is worth twice as much.', 'The shares halve. Half a bonus is still a bonus.'],
  ]),
  finance_insider: c('Inside information', 'A client lets slip that his company will be bought next week. Nobody would know if you bought its shares.', [
    'Keep quiet',
    ['Trade on it', 'The deal is announced, and nobody asks a thing.', 'The regulator spots the trade: a fine, the sack and your name in the papers.'],
  ]),
  finance_merger: c('The bank merges', 'A bigger bank buys yours. There is a post for you, a rung lower and better paid, or a payoff for those who leave.', [
    'Take the new post',
    'Take the payoff and stop working',
  ]),
  medicine_negligence: c('A negligence claim', 'A patient\'s family sues you over a diagnosis they say came too late. The hospital\'s lawyers suggest a settlement.', [
    'Settle',
    ['Fight it in court', 'The court clears you, and the press says so.', 'The court rules against you: damages, and a headline.'],
  ]),
  medicine_specialty: c('A specialty', 'A place opens to train in cardiology: years of exams and night shifts, and a better-paid post at the end.', [
    'Stay a generalist',
    'Train for it',
  ]),
  medicine_private_clinic: c('The private clinic', 'A private clinic wants you full time, at far more than the public hospital pays. Your patients would stay behind.', [
    'Stay at the public hospital',
    'Go private',
  ]),
  law_big_case: c('The case on every front page', 'A famous defendant wants you on the case. Win, and you are a name; lose, and you are a joke.', [
    'Turn it down',
    ['Take the case', 'You win. Every firm in town now knows your name.', 'You lose, on live television.'],
  ]),
  law_cash_client: c('A client who pays in cash', 'A man with a chain of nightclubs pays well, in cash, and asks for no receipts. He would rather not have any.', [
    'Turn him down',
    'Take the cash',
  ]),
  law_own_firm: c('A firm of your own', 'Two clients say they would follow you if you opened your own firm. The rent and the staff would be yours to pay.', [
    'Stay with the firm',
    ['Open your own firm', 'The clients follow, and bring others. Your name is on the door.', 'The clients stay where they were. You close within the year.'],
  ]),
  education_summer: c('The long summer', 'Two months without classes. A family is looking for a tutor, and the beach is looking for you.', [
    'Rest',
    'Give private lessons',
  ]),
  education_old_pupil: c('A former pupil', 'A pupil you once kept from dropping out is famous now, and thanks you in an interview.', [
    'Write back to thank them',
    'Ask them for a favour',
  ]),
  education_new_law: c('A new education law', 'The new government changes the curriculum again. New books, new forms, the same pay.', [
    'Do the minimum',
    'Learn the new curriculum',
    ['Join the protests', 'The law is withdrawn. The staffroom drinks to you.', 'The law passes anyway, and the head is not pleased.'],
  ]),
  influencer_dodgy_brand: c('A brand that pays too well', 'A slimming-tea brand offers a fortune for a month of posts. Its reviews are not kind.', [
    'Say no',
    ['Take the money', 'Nobody notices. The money is in the bank.', 'The tea is exposed, and so are you. Followers leave by the thousand.'],
  ]),
  influencer_shadowban: c('The shadowban', 'Your posts reach half the people they did, and nobody at the platform will say why.', [
    'Wait it out',
    ['Pay to promote your posts', 'The paid posts bring your audience back.', 'The money is spent, and the reach stays low anyway.'],
  ]),
  influencer_viral: c('A week of going viral', 'A video of yours is everywhere this week. Everyone wants a follow-up, now.', [
    'Let it pass',
    ['Ride the wave', 'The follow-ups land. You are in another league now.', 'The follow-ups fall flat. The internet has moved on.'],
  ]),
  hospitality_star: c('A shot at a star', 'Word is the guide\'s inspectors are in town. A season of perfect plates might win the restaurant a star.', [
    'Cook as usual',
    ['Go for the star', 'A star! The tables are booked for months, and your pay follows.', 'No star this year. Only the exhaustion.'],
  ]),
  hospitality_inspection: c('The health inspection', 'An inspector is due next week. The cold room is failing, and the owner will not pay to fix it.', [
    'Pay for the repair yourself',
    ['Hide it for the visit', 'The inspector looks the other way. Or never looks.', 'The inspector opens the cold room: a fine, and a sign on the door.'],
  ]),
  hospitality_next_door: c('The bar next door', 'The bar next door is for lease, fittings and all. You know every regular, and every mistake its owner made.', [
    'Let it go',
    'Take the lease',
  ]),
  sales_giant_client: c('The giant client', 'A giant client is choosing a supplier. Alone, it is a long shot; with a colleague, a sure thing at half the commission.', [
    'Share it with a colleague',
    ['Go after it alone', 'You land it. The biggest commission of your life.', 'A rival undercuts you at the last minute.'],
  ]),
  sales_quota: c('An impossible quota', 'The new sales director doubles everyone\'s quota. Hit it and there is a bonus; miss it and your base pay shrinks.', [
    ['Push yourself', 'Long days, late calls, and you hit it.', 'You fall short, and your base pay shrinks.'],
    ['Talk it down', 'A fairer quota, and you beat it.', 'The director will not budge, but your base pay stays.'],
    ['Talk it down, figures in hand', 'A fairer quota, and you beat it.', 'The director will not budge, but your base pay stays.'],
  ]),
  sales_poached: c('The competitor calls', 'A competitor wants you, and your clients with you. It pays well, and your firm will not forgive it.', [
    'Stay where you are',
    'Leave with your clients',
    ['Ask your firm to match it', 'Your firm matches part of it to keep you.', 'Your firm calls your bluff. Now everyone knows you looked elsewhere.'],
  ]),
  network_investors: c('Dinner with investors', 'A table of people who fund companies. Over dessert, one of them offers you a place in their next private round.', [
    'Just listen',
    ['Join the round', 'The company is bought. Your stake comes back four times over.', 'The company runs out of money, and your stake with it.'],
  ]),
  network_board_seat: c('A seat on the board', 'A company you know well wants you on its board: a fee every year, and a meeting that eats into every month.', [
    'Turn it down',
    'Take the seat',
  ]),
  network_listing: c('Shares below the market', '{asset:nvidia} is selling new shares to a few chosen buyers, below the market price. A banker you know can get you in.', [
    'Pass',
    'Take a small allocation',
    'Take a large allocation',
  ]),
  network_referral: c('A word in the right ear', 'A contact has put your name forward for the post above yours. The interview is next week.', [
    'Thank them',
    ['Go to the interview', 'They offer you the post.', 'They pick someone from inside. Your contact is sorry.'],
  ]),
  // Content 1.54: the legendary cards.
  legend_coat_ticket: c('The ticket in the old coat', 'In the pocket of a coat you have not worn for years: a lottery ticket. You check it three times. It won.', [
    'Cash it all',
    'Cash half, give half away',
    'Give it all to the children\'s hospital',
  ]),
  legend_stranger_will: c('A stranger\'s will', 'Years ago you helped an old man change a tyre in the rain. Now his notary calls: he left you everything.', [
    'Take his savings',
    'Keep his guesthouse by the sea',
  ]),
  legend_airdrop: c('The airdrop', 'The coin you bought as a joke has handed its holders new tokens. Yours are worth a fortune today. Tomorrow, who knows.', [
    'Sell it all today',
    ['Sell half, hold half', 'The other half doubles. You were a genius all along.', 'The other half goes to zero. Half a fortune is still a fortune.'],
    ['Hold it all', 'To the moon. You are on the news.', 'It goes to zero overnight. You keep a screenshot.'],
  ]),
  legend_viral: c('Eighty million views', 'Someone filmed you dancing at a wedding. Now the whole world has seen it, some of them twice.', [
    'Enjoy the fame',
    'Sell the rights to the clip',
    ['Launch the merch', 'The T-shirts sell out in a week. You order more.', 'A garage full of T-shirts nobody wants, and a few jokes about it.'],
  ]),
  legend_star_neighbour: c('A star next door', 'A film star has bought the house next to yours. Her parties are loud, and a magazine is very interested in them.', [
    'Wave over the fence',
    'Sell her stories to the magazine',
    'Make friends with her',
  ]),
  legend_attic_painting: c('The painting in the attic', 'Behind an old mirror in the attic: a painting. A dealer says it could be a lost master. Or a very good fake.', [
    'Sell it to the dealer',
    ['Have it authenticated', 'A lost master. The auction room claps.', 'A very good fake. It just pays the experts\' bill.'],
    'Lend it to the city museum',
  ]),
};
