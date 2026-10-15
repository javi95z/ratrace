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
  house_refinance: c('Fixed or variable', 'Your bank will switch your mortgage for a fee.', [
    'Leave it',
    'Fix the rate',
    'Go variable',
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
  life_club_contacts: c('At the bar of the club', 'Someone you nod to every week leans over with an opportunity.', [
    'Change the subject',
    ['Ask if they are hiring', 'They introduce you to the one who hires. You leave with a raise.', 'Kind words and nothing more.'],
    ['Go into their deal', 'It works. Your share arrives every year.', 'You never see that money again.'],
    ['Ask to meet the one who decides', 'One dinner later, they offer you the job above yours.', 'They listen with interest. They will call.'],
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
  luck_lottery: c('{brand:el_gordo}', 'The office is buying Christmas lottery tickets. Everyone is in.', [
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
    'Insulate the flat and be done with it',
    'Pay it, and put savings into gold',
  ]),
  crisis_energy_wages: c('Wages against prices', 'Prices have run two years ahead of pay. There is talk of a strike, and of who will blink first.', [
    'Wait it out',
    ['Walk out with the others', 'The raise is won.', 'The strike fails and the days are docked.'],
    'Cut back at home instead',
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
    ['Put in $3,000', 'The market rose: you triple it.', 'The market fell: it is gone.'],
  ]),
  house_noisy_neighbours: c('Noisy neighbours', 'Upstairs practise the drums at dinner time. And at bedtime.', [
    'Put up with it',
    'Soundproof the flat',
    'Find another flat to rent',
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
    ['Buy before Monday', 'Monday comes, the shares jump. You sell.', 'The shares jump, and so does the regulator.', 'There was no takeover. He meant another bank.'],
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
};
