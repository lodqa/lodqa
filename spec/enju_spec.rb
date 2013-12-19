require 'spec_helper'
require_relative '../enju'

describe "Enju", "Tests of error-handling" do
  it "should handle a bad Enju url" do
    expect { Enju.new("http://bionlp.dbcls.jp/enjuuuu") }.to raise_error
  end
  it "should handle a null Enju url" do
    url = nil
    expect { Enju.new(url) }.to raise_error
  end
  it "should handle an empty Enju url" do
    url = ""
    expect { Enju.new(url) }.to raise_error
  end
end

describe "Enju", "Tests of normal functionality" do
  it "should handle a sentence without a negative (test methods called by lodqa)" do
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("Show me devices used to treat heart failure.")
    # verify the results of the four method calls used in lodqa.rb
    e.get_head.should eql ([2, 3, 7]) 
    e.get_bnc[2].should eql ([2, 2]) # single-word chunk
    e.get_bnc[7].should eql ([6, 7]) # multi-word chunk
    e.get_rel.should eql ([2, [], 7]) # not sure about this one
    #e.get_focus.should eql (2) # method returns the index of the focus word
  end
  it "should handle a sentence without a negative (test methods used privately)"
  it "should handle a query that contains base noun chunks (1)" do
    # Here we're just checking that we don't crash in the boundary condition
    # where we only have a single base noun chunk--primarily interested in
    # array out of bounds erros and the like.
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("Show genes")
    e.get_head
    e.get_bnc
    e.get_rel
    e.get_focus
  end  
  it "should handle a query that contains base noun chunks (more than 1)"
  it "should not crash on a query with no base noun chunks"
  it "should handle sentence-final puncuation: period" do
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("Show me genes associated with heart disease.")
    # TODO add more here, e.g. check that last word is going to be
    # looked up without punctuation 
  end
  it "should handle sentence-final punctuation: question mark" do
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("What genes are associated with heart disease?")
    # TODO add more here, e.g. check that last word is going to be looked
    # up without punctuation
  end
  it "should handle lack of sentence-final punctuation" do
    # Avoid the stupid bug that I made in my address parser at MapQuest!
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("What devices are used to treat heart failure")    
    # No need to check anything here--just trying to not crash.
  end
  it "should handle sentence-medial punctuation" 
  it "should handle all noun phrase elements"
  it "should handle all noun chunk elements"
  it "should handle all wh categories"
  it "should handle conjunction" do
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("What signs and disorders are associated with CHF?") # conjoined subj
    e.get_focus.should eql ("dummy value until I know the expected output")
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("What genes are associated with hypertension and diabetes?")        # conjoined object
    # TODO check something!
    # TODO conjoined predicate
  end
  it "should handle disjunction" do
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("What signs or disorders are associated with CHF?") # disjunct subj
    e.get_focus.should eql ("dummy value until I know the expected output")     
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("What genes are associated with hypertension or diabetes?") # disjunct object
    # TODO check something!
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("What genes upregulate or downregulate p53?")
    # TODO check something!
  end  
  it "should handle a single-word sentence without crashing"
    # surprisingly common boundary case
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("Genes")
    e.get_head
    e.get_bnc
    e.get_rel
    e.get_focus
    # No need to check anything--we just want to see that we can call
    # all methods that get used publicly without crashing
  it "should handle a sentence that contains a negative without bad effects"
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("What genes are not regulated by Tolle?")
    # Nothing to check yet--just verifying that we don't crash.  
  it "should handle a variety of types of focuses"
  it "should handle a variety of wh-words"
  it "should handle questions with and without wh-words"
  it "should handle multi-word focus" do
    e = Enju.new("http://bionlp.dbcls.jp/enju")
    e.parse("What childhood diseases are associated with ALE1?")
    e.get_focus.should eql ("dummy value until I know the expected output")    
  end 
  it "should handle command-line operation"
  it "should correctly handle all paths through code to populating the head variable"
  it "should handle UTF-8"
  it "should handle multiple parse() calls without having left-over state"
end
