require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { Transaction, Beneficiary } = require('../models/index');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('\n🔗 Connected to MongoDB\n');

  await User.deleteMany({ email:{ $in:['demo@gkcapital.in','priya@gkcapital.in'] } });
  await Transaction.deleteMany({});
  await Beneficiary.deleteMany({});

  const user = await User.create({
    firstName:'Gouse', lastName:'Kareem',
    email:'demo@gkcapital.in',
    phone:'9000000001',   // ← CHANGE THIS to your real 10-digit phone for real OTP
    password:'Demo@1234',
    isEmailVerified:true, isKYCDone:true,
    balance:87450.50, ifscCode:'GKCB0001234', branchName:'Hyderabad Main Branch',
    creditScore:742, roundUpEnabled:true, roundUpBalance:234.50, carbonFootprint:18.4,
  });

  const receiver = await User.create({
    firstName:'Priya', lastName:'Sharma',
    email:'priya@gkcapital.in', phone:'9000000002',
    password:'Demo@1234', balance:45000, isEmailVerified:true,
  });

  await Beneficiary.create([
    { userId:user._id, name:'Priya Sharma',  accountNumber:receiver.accountNumber, ifscCode:'GKCB0001234', bankName:'GK Capital Bank', nickname:'Wife'    },
    { userId:user._id, name:'Ravi Kumar',    accountNumber:'40123456789',           ifscCode:'ICIC0001234', bankName:'ICICI Bank',      nickname:'Brother' },
    { userId:user._id, name:'Sunita Devi',   accountNumber:'50987654321',           ifscCode:'HDFC0001234', bankName:'HDFC Bank',       nickname:'Mom'     },
  ]);

  const txs = [
    { type:'credit', amt:35000, desc:'Salary - INFOSYS',              cat:'salary',        days:1,  merchant:'Infosys Ltd'      },
    { type:'debit',  amt:1299,  desc:'Netflix Subscription',          cat:'entertainment', days:2,  merchant:'Netflix'          },
    { type:'debit',  amt:4580,  desc:'Zomato Food Order',             cat:'food',          days:3,  merchant:'Zomato'           },
    { type:'debit',  amt:1820,  desc:'Uber Cab Rides',                cat:'travel',        days:4,  merchant:'Uber India'       },
    { type:'credit', amt:5000,  desc:'Transfer from Priya',           cat:'other',         days:5,  merchant:'IMPS'             },
    { type:'debit',  amt:12500, desc:'Amazon Shopping',               cat:'shopping',      days:6,  merchant:'Amazon'           },
    { type:'debit',  amt:3200,  desc:'Petrol - IOCL Pump',            cat:'fuel',          days:7,  merchant:'IOCL'             },
    { type:'debit',  amt:2100,  desc:'Electricity Bill - TSEDCL',     cat:'utilities',     days:8,  merchant:'TSEDCL'           },
    { type:'credit', amt:15000, desc:'Freelance Payment',             cat:'salary',        days:12, merchant:'Razorpay'         },
    { type:'debit',  amt:8900,  desc:'KIMS Hospital',                 cat:'healthcare',    days:15, merchant:'KIMS Hospitals'   },
    { type:'debit',  amt:850,   desc:'Spotify Premium',               cat:'entertainment', days:18, merchant:'Spotify'          },
    { type:'credit', amt:50000, desc:'Salary - INFOSYS',              cat:'salary',        days:32, merchant:'Infosys Ltd'      },
    { type:'debit',  amt:18000, desc:'Flipkart Shopping',             cat:'shopping',      days:36, merchant:'Flipkart'         },
    { type:'debit',  amt:3500,  desc:'PVR Cinemas',                   cat:'entertainment', days:40, merchant:'PVR'              },
    { type:'debit',  amt:6200,  desc:'MakeMyTrip Hotel',              cat:'travel',        days:45, merchant:'MakeMyTrip'       },
    { type:'credit', amt:50000, desc:'Salary - INFOSYS',              cat:'salary',        days:62, merchant:'Infosys Ltd'      },
    { type:'debit',  amt:9000,  desc:'Vijay Sales Electronics',       cat:'shopping',      days:65, merchant:'Vijay Sales'      },
    { type:'debit',  amt:2800,  desc:'Airtel Broadband',              cat:'utilities',     days:70, merchant:'Airtel'           },
    { type:'credit', amt:50000, desc:'Salary - INFOSYS',              cat:'salary',        days:92, merchant:'Infosys Ltd'      },
  ];

  let bal = 87450.50;
  for (const tx of txs) {
    const date = new Date(Date.now() - tx.days * 24 * 3600 * 1000);
    const bb   = bal;
    if (tx.type==='debit') bal -= tx.amt; else bal += tx.amt;
    await Transaction.create({
      idempotencyKey:uuidv4(),
      fromAccountNumber: tx.type==='debit'  ? user.accountNumber     : receiver.accountNumber,
      toAccountNumber:   tx.type==='credit' ? user.accountNumber     : receiver.accountNumber,
      fromUserId: tx.type==='debit'  ? user._id     : receiver._id,
      toUserId:   tx.type==='credit' ? user._id     : receiver._id,
      amount:tx.amt, type:tx.type==='credit'?'credit':'transfer',
      category:tx.cat, description:tx.desc, merchant:tx.merchant,
      status:'completed', transferMode:'IMPS',
      balanceBefore:bb, balanceAfter:bal, processedAt:date, createdAt:date,
    });
  }

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       GK Capital Bank — Demo Account         ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Email:      demo@gkcapital.in               ║`);
  console.log(`║  Password:   Demo@1234                       ║`);
  console.log(`║  Phone:      ${user.phone}                    ║`);
  console.log(`║  Account:    ${user.accountNumber}      ║`);
  console.log(`║  Customer:   ${user.customerId}          ║`);
  console.log(`║  Balance:    ₹87,450.50                      ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n✅ Receiver: priya@gkcapital.in (Acc: ${receiver.accountNumber})`);
  console.log(`✅ ${txs.length} transactions + 3 beneficiaries seeded`);
  console.log('\n📱 OTP prints in terminal (SMS_PROVIDER=console)');
  console.log('   For real phone OTP: set SMS_PROVIDER=fast2sms in .env\n');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
